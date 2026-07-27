package bazar

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo     *Repository
	sheets   SheetsGateway
	location *time.Location
	syncMu   sync.Mutex
}

func NewService(repo *Repository, sheets SheetsGateway, timezone string) *Service {
	location, err := time.LoadLocation(strings.TrimSpace(timezone))
	if err != nil {
		location, err = time.LoadLocation("America/Mexico_City")
	}
	if err != nil {
		location = time.UTC
	}
	return &Service{repo: repo, sheets: sheets, location: location}
}

func (s *Service) SyncProducts(ctx context.Context, organizationID string) (int, error) {
	s.syncMu.Lock()
	defer s.syncMu.Unlock()
	return s.syncProducts(ctx, organizationID, "use_sheet")
}

func (s *Service) syncProducts(ctx context.Context, organizationID, conflictStrategy string) (int, error) {
	if configured, message := s.sheets.Configured(); !configured {
		return 0, &serviceError{Status: http.StatusServiceUnavailable, Message: message}
	}
	products, err := s.sheets.ReadProducts(ctx)
	if err != nil {
		return 0, err
	}
	if err := s.repo.UpsertSheetProducts(ctx, organizationID, products, conflictStrategy); err != nil {
		return 0, err
	}
	return len(products), nil
}

func (s *Service) CreateProduct(
	ctx context.Context,
	organizationID string,
	actorID uuid.UUID,
	actorName string,
	req CreateProductRequest,
) (*Product, error) {
	command, err := prepareCreateProduct(req)
	if err != nil {
		return nil, err
	}
	product, err := s.repo.CreateManualProduct(ctx, organizationID, command)
	if err != nil {
		return nil, err
	}
	_ = s.repo.RecordAudit(
		ctx,
		organizationID,
		nil,
		actorID,
		actorName,
		"product.created",
		"product",
		&product.ID,
		map[string]any{"sku": product.ExternalID, "name": product.Name, "stock": product.Stock},
	)
	return product, nil
}

func (s *Service) UpdateProduct(
	ctx context.Context,
	organizationID string,
	actorID uuid.UUID,
	actorName string,
	productID uuid.UUID,
	req UpdateProductRequest,
) (*Product, error) {
	current, err := s.repo.GetProduct(ctx, organizationID, productID)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, &serviceError{Status: http.StatusNotFound, Message: "Producto no encontrado."}
	}
	command, err := prepareUpdateProduct(*current, req)
	if err != nil {
		return nil, err
	}
	updated, err := s.repo.UpdateProduct(ctx, organizationID, productID, command)
	if err != nil {
		return nil, err
	}
	_ = s.repo.RecordAudit(
		ctx,
		organizationID,
		nil,
		actorID,
		actorName,
		"product.updated",
		"product",
		&productID,
		map[string]any{"before": current, "after": updated},
	)
	return updated, nil
}

func (s *Service) AdjustStock(
	ctx context.Context,
	organizationID string,
	actorID uuid.UUID,
	actorName string,
	productID uuid.UUID,
	req AdjustStockRequest,
) (*Product, error) {
	command, err := prepareStockAdjustment(productID, actorID, actorName, req)
	if err != nil {
		return nil, err
	}
	updated, err := s.repo.AdjustStock(ctx, organizationID, command)
	if err != nil {
		return nil, err
	}
	_ = s.repo.RecordAudit(
		ctx,
		organizationID,
		command.BazarID,
		actorID,
		actorName,
		"inventory.adjusted",
		"product",
		&productID,
		map[string]any{
			"movement_type": command.MovementType,
			"quantity":      command.Delta,
			"stock_after":   updated.Stock,
			"reason":        command.Reason,
		},
	)
	return updated, nil
}

// maxSaleBackdateDays limita qué tan atrás se puede capturar una venta: cubre
// ponerse al corriente con la libreta sin abrir la puerta a fechas absurdas.
const maxSaleBackdateDays = 90

// resolveSaleDate normaliza la fecha elegida por el vendedor. Sin fecha usa el
// momento actual; con fecha conserva la hora si viene, y si solo viene el día
// la coloca al mediodía local para que ningún ajuste de zona horaria la mueva
// al día anterior o siguiente.
func (s *Service) resolveSaleDate(requested *time.Time) (*time.Time, error) {
	if requested == nil {
		return nil, nil
	}

	now := time.Now().In(s.location)
	local := requested.In(s.location)
	if local.Hour() == 0 && local.Minute() == 0 && local.Second() == 0 {
		local = time.Date(local.Year(), local.Month(), local.Day(), 12, 0, 0, 0, s.location)
	}

	if local.After(now.Add(5 * time.Minute)) {
		return nil, &serviceError{
			Status:  http.StatusBadRequest,
			Message: "No se pueden registrar ventas con fecha futura.",
		}
	}
	oldest := now.AddDate(0, 0, -maxSaleBackdateDays)
	if local.Before(oldest) {
		return nil, &serviceError{
			Status:  http.StatusBadRequest,
			Message: fmt.Sprintf("Solo se pueden capturar ventas de los últimos %d días.", maxSaleBackdateDays),
		}
	}
	return &local, nil
}

func (s *Service) CreateSale(
	ctx context.Context,
	organizationID string,
	userID uuid.UUID,
	sellerName string,
	req CreateSaleRequest,
) (*CreateSaleResult, error) {
	clientRequestID, err := uuid.Parse(strings.TrimSpace(req.ClientRequestID))
	if err != nil {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: "client_request_id debe ser un UUID válido."}
	}
	bazarID, err := uuid.Parse(strings.TrimSpace(req.BazarID))
	if err != nil {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: "Selecciona un bazar válido."}
	}

	requestItems := req.Items
	if len(requestItems) == 0 && strings.TrimSpace(req.ProductID) != "" {
		requestItems = []CreateSaleItemRequest{{
			ProductID: req.ProductID,
			Quantity:  req.Quantity,
		}}
	}
	if len(requestItems) == 0 {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: "La venta debe incluir al menos un producto."}
	}

	quantities := make(map[uuid.UUID]int)
	for _, requestItem := range requestItems {
		productID, err := uuid.Parse(strings.TrimSpace(requestItem.ProductID))
		if err != nil {
			return nil, &serviceError{Status: http.StatusBadRequest, Message: "La venta contiene un producto inválido."}
		}
		if requestItem.Quantity <= 0 || requestItem.Quantity > 999 {
			return nil, &serviceError{Status: http.StatusBadRequest, Message: "La cantidad debe estar entre 1 y 999."}
		}
		quantities[productID] += requestItem.Quantity
		if quantities[productID] > 999 {
			return nil, &serviceError{Status: http.StatusBadRequest, Message: "La cantidad acumulada no puede superar 999."}
		}
	}

	productIDs := make([]uuid.UUID, 0, len(quantities))
	for productID := range quantities {
		productIDs = append(productIDs, productID)
	}
	sort.Slice(productIDs, func(i, j int) bool {
		return productIDs[i].String() < productIDs[j].String()
	})

	items := make([]createSaleItemCommand, 0, len(productIDs))
	for _, productID := range productIDs {
		items = append(items, createSaleItemCommand{
			ProductID: productID,
			Quantity:  quantities[productID],
		})
	}

	paymentMethod := normalizePaymentMethod(req.PaymentMethod)
	if paymentMethod == "" {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: "El método de pago no es válido."}
	}
	if req.CashReceived != nil {
		if paymentMethod != PaymentCash {
			return nil, &serviceError{Status: http.StatusBadRequest, Message: "El efectivo recibido solo aplica a pagos en efectivo."}
		}
		if *req.CashReceived < 0 || *req.CashReceived > 999999999 {
			return nil, &serviceError{Status: http.StatusBadRequest, Message: "El efectivo recibido no es válido."}
		}
	}
	if strings.TrimSpace(sellerName) == "" {
		sellerName = "Vendedor"
	}

	soldAt, err := s.resolveSaleDate(req.SoldAt)
	if err != nil {
		return nil, err
	}
	if soldAt != nil {
		businessDate := time.Date(soldAt.Year(), soldAt.Month(), soldAt.Day(), 0, 0, 0, 0, s.location)
		closed, err := s.repo.HasDailyCut(ctx, organizationID, bazarID, businessDate)
		if err != nil {
			return nil, err
		}
		if closed {
			return nil, &serviceError{
				Status:  http.StatusConflict,
				Message: "Ese día ya tiene corte de caja cerrado; no se le pueden agregar ventas.",
			}
		}
	}

	result, err := s.repo.CreateSale(ctx, organizationID, createSaleCommand{
		ClientRequestID: clientRequestID,
		BazarID:         bazarID,
		SellerID:        userID,
		SellerName:      sellerName,
		Items:           items,
		PaymentMethod:   paymentMethod,
		CashReceived:    req.CashReceived,
		Notes:           req.Notes,
		SoldAt:          soldAt,
	})
	if err != nil {
		return nil, err
	}

	if !result.Duplicated && result.Sale != nil {
		_ = s.repo.RecordAudit(
			ctx,
			organizationID,
			&bazarID,
			userID,
			sellerName,
			"sale.created",
			"sale",
			&result.Sale.ID,
			map[string]any{"total": result.Sale.Total, "items": result.Sale.Items},
		)
	}
	s.syncSaleAsync(organizationID, result.Sale)
	return result, nil
}

func (s *Service) CancelSale(
	ctx context.Context,
	organizationID string,
	saleID, userID uuid.UUID,
	actorName string,
	canCancelAny bool,
) (*Sale, error) {
	sale, err := s.repo.CancelSale(ctx, organizationID, saleID, userID, canCancelAny)
	if err != nil {
		return nil, err
	}
	_ = s.repo.RecordAudit(
		ctx,
		organizationID,
		&sale.BazarID,
		userID,
		actorName,
		"sale.cancelled",
		"sale",
		&sale.ID,
		map[string]any{"total": sale.Total},
	)
	s.syncSaleAsync(organizationID, sale)
	return sale, nil
}

func (s *Service) SyncConflicts(ctx context.Context, organizationID string) ([]SyncConflict, error) {
	if configured, message := s.sheets.Configured(); !configured {
		return nil, &serviceError{Status: http.StatusServiceUnavailable, Message: message}
	}
	products, err := s.sheets.ReadProducts(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.FindSyncConflicts(ctx, organizationID, products)
}

func (s *Service) SyncAll(ctx context.Context, organizationID, conflictStrategy string) (*SyncResult, error) {
	s.syncMu.Lock()
	defer s.syncMu.Unlock()

	if configured, message := s.sheets.Configured(); !configured {
		return nil, &serviceError{Status: http.StatusServiceUnavailable, Message: message}
	}

	products, err := s.sheets.ReadProducts(ctx)
	if err != nil {
		return nil, fmt.Errorf("leer productos: %w", err)
	}
	conflicts, err := s.repo.FindSyncConflicts(ctx, organizationID, products)
	if err != nil {
		return nil, err
	}
	if len(conflicts) > 0 && conflictStrategy != "keep_manual" && conflictStrategy != "use_sheet" {
		return nil, &serviceError{
			Status:  http.StatusConflict,
			Message: fmt.Sprintf("Hay %d productos con diferencias entre el inventario manual y Google Sheets.", len(conflicts)),
		}
	}
	if conflictStrategy == "" {
		conflictStrategy = "use_sheet"
	}

	sales, err := s.repo.ListUnsyncedSales(ctx, organizationID, 100)
	if err != nil {
		return nil, err
	}
	result := &SyncResult{}
	for index := range sales {
		if err := s.syncSaleUnlocked(ctx, organizationID, &sales[index]); err != nil {
			result.SalesFailed++
			continue
		}
		result.SalesSynced++
	}
	if result.SalesFailed > 0 {
		return result, nil
	}

	if result.SalesSynced > 0 {
		products, err = s.sheets.ReadProducts(ctx)
		if err != nil {
			return nil, fmt.Errorf("releer productos después de sincronizar ventas: %w", err)
		}
	}
	if err := s.repo.UpsertSheetProducts(ctx, organizationID, products, conflictStrategy); err != nil {
		return nil, fmt.Errorf("sincronizar productos: %w", err)
	}
	result.ProductsImported = len(products)
	result.ConflictsResolved = len(conflicts)
	return result, nil
}

func (s *Service) syncSaleAsync(organizationID string, sale *Sale) {
	if sale == nil {
		return
	}
	if configured, _ := s.sheets.Configured(); !configured {
		return
	}
	saleCopy := *sale
	saleCopy.Items = append([]SaleItem(nil), sale.Items...)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		_ = s.syncSale(ctx, organizationID, &saleCopy)
	}()
}

func (s *Service) syncSale(ctx context.Context, organizationID string, sale *Sale) error {
	s.syncMu.Lock()
	defer s.syncMu.Unlock()
	return s.syncSaleUnlocked(ctx, organizationID, sale)
}

func (s *Service) syncSaleUnlocked(ctx context.Context, organizationID string, sale *Sale) error {
	if sale == nil {
		return nil
	}
	stocks, err := s.repo.GetCurrentStocksForSale(ctx, organizationID, sale.ID)
	if err != nil {
		_ = s.repo.MarkSaleSyncError(ctx, organizationID, sale.ID, err)
		return err
	}
	if err := s.sheets.SyncSale(ctx, sale, stocks); err != nil {
		_ = s.repo.MarkSaleSyncError(ctx, organizationID, sale.ID, err)
		return err
	}
	return s.repo.MarkSaleSynced(ctx, organizationID, sale.ID)
}

// dayWindow devuelve el inicio y el fin del dia pedido en la zona horaria de
// la organizacion. Sin fecha usa el dia de hoy.
func (s *Service) dayWindow(rawDate string) (time.Time, time.Time, error) {
	now := time.Now().In(s.location)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, s.location)
	if value := strings.TrimSpace(rawDate); value != "" {
		parsed, err := time.ParseInLocation("2006-01-02", value, s.location)
		if err != nil {
			return time.Time{}, time.Time{}, &serviceError{Status: http.StatusBadRequest, Message: "La fecha no es válida."}
		}
		start = parsed
	}
	return start, start.AddDate(0, 0, 1), nil
}

func (s *Service) DailyStats(ctx context.Context, organizationID string, bazarID *uuid.UUID) (*DailyStats, error) {
	start, end, err := s.dayWindow("")
	if err != nil {
		return nil, err
	}
	return s.repo.GetDailyStats(ctx, organizationID, bazarID, start, end)
}

// DailyActivity entrega el resumen y las ventas de un mismo dia. La lista se
// acota a esa jornada: antes devolvia las ultimas ventas del bazar sin
// importar la fecha, asi que en la pantalla de hoy aparecian dias anteriores.
func (s *Service) DailyActivity(
	ctx context.Context,
	organizationID string,
	bazarID *uuid.UUID,
	rawDate string,
	limit int,
) (*DailyStats, []Sale, error) {
	start, end, err := s.dayWindow(rawDate)
	if err != nil {
		return nil, nil, err
	}
	stats, err := s.repo.GetDailyStats(ctx, organizationID, bazarID, start, end)
	if err != nil {
		return nil, nil, err
	}
	sales, err := s.repo.ListSales(ctx, organizationID, bazarID, &start, &end, limit)
	if err != nil {
		return nil, nil, err
	}
	return stats, sales, nil
}

func (s *Service) CloseDailyCut(
	ctx context.Context,
	organizationID string,
	bazarID, actorID uuid.UUID,
	actorName string,
	req CreateDailyCutRequest,
) (*DailyCut, error) {
	if req.OpeningCash < 0 || req.OpeningCash > 999999999 ||
		req.ClosingCash < 0 || req.ClosingCash > 999999999 {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: "Los importes del corte no son válidos."}
	}

	now := time.Now().In(s.location)
	businessDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, s.location)
	if rawDate := strings.TrimSpace(req.Date); rawDate != "" {
		parsed, err := time.ParseInLocation("2006-01-02", rawDate, s.location)
		if err != nil {
			return nil, &serviceError{Status: http.StatusBadRequest, Message: "La fecha del corte no es válida."}
		}
		if parsed.After(businessDate) {
			return nil, &serviceError{Status: http.StatusBadRequest, Message: "No puedes registrar un corte futuro."}
		}
		businessDate = parsed
	}

	cut, err := s.repo.CloseDailyCut(
		ctx,
		organizationID,
		bazarID,
		actorID,
		actorName,
		businessDate,
		businessDate,
		businessDate.AddDate(0, 0, 1),
		req.OpeningCash,
		req.ClosingCash,
		sanitizeString(&req.Notes),
	)
	if err != nil {
		return nil, err
	}
	_ = s.repo.RecordAudit(
		ctx,
		organizationID,
		&bazarID,
		actorID,
		actorName,
		"cash.daily_cut",
		"daily_cut",
		&cut.ID,
		map[string]any{
			"date":            cut.BusinessDate,
			"expected_cash":   cut.ExpectedCash,
			"closing_cash":    cut.ClosingCash,
			"cash_difference": cut.CashDifference,
		},
	)
	return cut, nil
}

func (s *Service) ListDailyCuts(
	ctx context.Context,
	organizationID string,
	bazarID uuid.UUID,
) ([]DailyCut, error) {
	return s.repo.ListDailyCuts(ctx, organizationID, bazarID, 90)
}

func (s *Service) CloseBazar(
	ctx context.Context,
	organizationID string,
	bazarID, actorID uuid.UUID,
	actorName string,
	req CloseBazarRequest,
) (*Bazar, error) {
	if req.ClosingCash < 0 || req.ClosingCash > 999999999 {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: "El efectivo contado no es válido."}
	}
	closed, err := s.repo.CloseBazar(
		ctx,
		organizationID,
		bazarID,
		actorID,
		req.ClosingCash,
		sanitizeString(&req.Notes),
	)
	if err != nil {
		return nil, err
	}
	_ = s.repo.RecordAudit(
		ctx,
		organizationID,
		&bazarID,
		actorID,
		actorName,
		"bazar.closed",
		"bazar",
		&bazarID,
		map[string]any{
			"expected_cash":   closed.ExpectedCash,
			"closing_cash":    closed.ClosingCash,
			"cash_difference": closed.CashDifference,
		},
	)
	return closed, nil
}

func (s *Service) Report(
	ctx context.Context,
	organizationID string,
	bazarID *uuid.UUID,
	rawDate string,
) (*BazarReport, error) {
	date, next, err := s.dayWindow(rawDate)
	if err != nil {
		return nil, err
	}
	return s.repo.GetReport(ctx, organizationID, bazarID, date, next)
}

func (s *Service) FinalBazarReport(
	ctx context.Context,
	organizationID string,
	bazarID uuid.UUID,
) (*BazarReport, error) {
	bazarItem, err := s.repo.GetBazar(ctx, organizationID, bazarID)
	if err != nil {
		return nil, err
	}
	if bazarItem == nil {
		return nil, &serviceError{Status: http.StatusNotFound, Message: "Bazar no encontrado."}
	}
	to := time.Now().In(s.location)
	if bazarItem.EndsAt != nil {
		to = bazarItem.EndsAt.Add(time.Nanosecond)
	}
	return s.repo.GetReport(ctx, organizationID, &bazarID, bazarItem.StartsAt, to)
}

func prepareCreateProduct(req CreateProductRequest) (createProductCommand, error) {
	productID := uuid.New()
	if rawID := strings.TrimSpace(req.ID); rawID != "" {
		parsedID, err := uuid.Parse(rawID)
		if err != nil {
			return createProductCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "El ID del producto no es válido."}
		}
		productID = parsedID
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return createProductCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "El nombre del producto es obligatorio."}
	}
	if len(name) > 160 {
		return createProductCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "El nombre del producto no puede superar 160 caracteres."}
	}

	sku := strings.TrimSpace(req.SKU)
	if sku == "" {
		sku = "MAN-" + strings.ToUpper(strings.ReplaceAll(uuid.NewString(), "-", "")[:8])
	}
	if len(sku) > 80 {
		return createProductCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "El código SKU no puede superar 80 caracteres."}
	}

	category := strings.TrimSpace(req.Category)
	if len(category) > 100 {
		return createProductCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "La categoría no puede superar 100 caracteres."}
	}
	if req.Price < 0 || req.Price > 999999999 {
		return createProductCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "El precio debe estar entre 0 y 999,999,999."}
	}
	if req.Cost != nil && (*req.Cost < 0 || *req.Cost > 999999999) {
		return createProductCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "El costo debe estar entre 0 y 999,999,999."}
	}
	if req.Stock < 0 || req.Stock > 999999 {
		return createProductCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "El stock debe estar entre 0 y 999,999."}
	}

	imageURL, err := validateProductImage(req.ImageURL)
	if err != nil {
		return createProductCommand{}, err
	}
	trackStock := true
	if req.TrackStock != nil {
		trackStock = *req.TrackStock
	}
	variantGroupID, variantName, variantColor, err := prepareProductVariant(
		req.VariantGroupID,
		req.VariantName,
		req.VariantColor,
	)
	if err != nil {
		return createProductCommand{}, err
	}

	return createProductCommand{
		ID:             productID,
		SKU:            sku,
		Name:           name,
		Category:       category,
		Price:          req.Price,
		Cost:           req.Cost,
		Stock:          req.Stock,
		TrackStock:     trackStock,
		ImageURL:       imageURL,
		VariantGroupID: variantGroupID,
		VariantName:    variantName,
		VariantColor:   variantColor,
	}, nil
}

func prepareUpdateProduct(current Product, req UpdateProductRequest) (updateProductCommand, error) {
	variantGroupID := ""
	if current.VariantGroupID != nil {
		variantGroupID = current.VariantGroupID.String()
	}
	createRequest := CreateProductRequest{
		SKU:            current.ExternalID,
		Name:           current.Name,
		Category:       current.Category,
		Price:          current.Price,
		Cost:           current.Cost,
		Stock:          current.Stock,
		TrackStock:     &current.TrackStock,
		ImageURL:       current.ImageURL,
		VariantGroupID: variantGroupID,
		VariantName:    current.VariantName,
		VariantColor:   current.VariantColor,
	}
	if req.SKU != nil {
		createRequest.SKU = *req.SKU
	}
	if req.Name != nil {
		createRequest.Name = *req.Name
	}
	if req.Category != nil {
		createRequest.Category = *req.Category
	}
	if req.Price != nil {
		createRequest.Price = *req.Price
	}
	if req.Cost != nil {
		createRequest.Cost = req.Cost
	}
	if req.ImageURL != nil {
		createRequest.ImageURL = req.ImageURL
	}
	if req.VariantGroupID != nil {
		createRequest.VariantGroupID = *req.VariantGroupID
	}
	if req.VariantName != nil {
		createRequest.VariantName = *req.VariantName
	}
	if req.VariantColor != nil {
		createRequest.VariantColor = req.VariantColor
	}
	prepared, err := prepareCreateProduct(createRequest)
	if err != nil {
		return updateProductCommand{}, err
	}
	active := current.Active
	if req.Active != nil {
		active = *req.Active
	}
	syncPolicy := current.SyncPolicy
	if req.SyncPolicy != nil {
		syncPolicy = strings.TrimSpace(*req.SyncPolicy)
	}
	if syncPolicy != "manual" && syncPolicy != "sheets" {
		return updateProductCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "La política de sincronización no es válida."}
	}
	return updateProductCommand{
		SKU:            prepared.SKU,
		Name:           prepared.Name,
		Category:       prepared.Category,
		Price:          prepared.Price,
		Cost:           prepared.Cost,
		ImageURL:       prepared.ImageURL,
		Active:         active,
		TrackStock:     prepared.TrackStock,
		SyncPolicy:     syncPolicy,
		VariantGroupID: prepared.VariantGroupID,
		VariantName:    prepared.VariantName,
		VariantColor:   prepared.VariantColor,
	}, nil
}

func prepareProductVariant(
	rawGroupID, rawName string,
	rawColor *string,
) (*uuid.UUID, string, *string, error) {
	groupID := strings.TrimSpace(rawGroupID)
	name := strings.TrimSpace(rawName)
	var color *string
	if rawColor != nil {
		normalized := strings.ToUpper(strings.TrimSpace(*rawColor))
		if normalized != "" {
			color = &normalized
		}
	}

	if groupID == "" && name == "" && color == nil {
		return nil, "", nil, nil
	}
	if groupID == "" {
		return nil, "", nil, &serviceError{
			Status:  http.StatusBadRequest,
			Message: "El grupo de la variante es obligatorio.",
		}
	}
	parsedGroupID, err := uuid.Parse(groupID)
	if err != nil {
		return nil, "", nil, &serviceError{
			Status:  http.StatusBadRequest,
			Message: "El grupo de variantes no es válido.",
		}
	}
	if name == "" {
		return nil, "", nil, &serviceError{
			Status:  http.StatusBadRequest,
			Message: "El nombre de la variante es obligatorio.",
		}
	}
	if len(name) > 80 {
		return nil, "", nil, &serviceError{
			Status:  http.StatusBadRequest,
			Message: "El nombre de la variante no puede superar 80 caracteres.",
		}
	}
	if color != nil && !isHexColor(*color) {
		return nil, "", nil, &serviceError{
			Status:  http.StatusBadRequest,
			Message: "El color de la variante no es válido.",
		}
	}
	return &parsedGroupID, name, color, nil
}

func isHexColor(value string) bool {
	if len(value) != 7 || value[0] != '#' {
		return false
	}
	for _, character := range value[1:] {
		if !((character >= '0' && character <= '9') ||
			(character >= 'A' && character <= 'F') ||
			(character >= 'a' && character <= 'f')) {
			return false
		}
	}
	return true
}

func prepareStockAdjustment(
	productID, actorID uuid.UUID,
	actorName string,
	req AdjustStockRequest,
) (adjustStockCommand, error) {
	movementType := strings.TrimSpace(req.MovementType)
	if req.Quantity == 0 || req.Quantity < -999999 || req.Quantity > 999999 {
		return adjustStockCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "La cantidad del movimiento no es válida."}
	}

	delta := req.Quantity
	switch movementType {
	case "inventory_entry", "return":
		if delta < 0 {
			delta = -delta
		}
	case "damaged", "lost", "gift", "sample":
		if delta > 0 {
			delta = -delta
		}
	case "manual_adjustment":
	default:
		return adjustStockCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "El tipo de movimiento no es válido."}
	}

	var bazarID *uuid.UUID
	if rawID := strings.TrimSpace(req.BazarID); rawID != "" {
		parsed, err := uuid.Parse(rawID)
		if err != nil {
			return adjustStockCommand{}, &serviceError{Status: http.StatusBadRequest, Message: "El bazar seleccionado no es válido."}
		}
		bazarID = &parsed
	}
	return adjustStockCommand{
		BazarID:      bazarID,
		ProductID:    productID,
		MovementType: movementType,
		Delta:        delta,
		Reason:       sanitizeString(&req.Reason),
		ActorID:      actorID,
		ActorName:    actorName,
	}, nil
}

func validateProductImage(raw *string) (*string, error) {
	if raw == nil {
		return nil, nil
	}
	value := strings.TrimSpace(*raw)
	if value == "" {
		return nil, nil
	}
	if strings.HasPrefix(value, "data:image/") {
		parts := strings.SplitN(value, ",", 2)
		if len(parts) != 2 || !strings.HasSuffix(parts[0], ";base64") {
			return nil, &serviceError{Status: http.StatusBadRequest, Message: "La imagen cargada no es válida."}
		}
		mime := strings.TrimSuffix(strings.TrimPrefix(parts[0], "data:"), ";base64")
		switch mime {
		case "image/jpeg", "image/png", "image/webp":
		default:
			return nil, &serviceError{Status: http.StatusBadRequest, Message: "La imagen debe ser JPG, PNG o WebP."}
		}
		decoded, err := base64.StdEncoding.DecodeString(parts[1])
		if err != nil || len(decoded) == 0 || len(decoded) > 700_000 {
			return nil, &serviceError{Status: http.StatusBadRequest, Message: "La imagen no es válida o supera el tamaño permitido."}
		}
		return &value, nil
	}
	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: "La URL de imagen debe comenzar con http:// o https://."}
	}
	return &value, nil
}
