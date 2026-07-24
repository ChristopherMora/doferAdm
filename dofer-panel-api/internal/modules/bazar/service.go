package bazar

import (
	"context"
	"fmt"
	"net/http"
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
	return s.syncProducts(ctx, organizationID)
}

func (s *Service) syncProducts(ctx context.Context, organizationID string) (int, error) {
	if configured, message := s.sheets.Configured(); !configured {
		return 0, &serviceError{Status: http.StatusServiceUnavailable, Message: message}
	}
	products, err := s.sheets.ReadProducts(ctx)
	if err != nil {
		return 0, err
	}
	if err := s.repo.UpsertSheetProducts(ctx, organizationID, products); err != nil {
		return 0, err
	}
	return len(products), nil
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
	if strings.TrimSpace(sellerName) == "" {
		sellerName = "Vendedor"
	}

	result, err := s.repo.CreateSale(ctx, organizationID, createSaleCommand{
		ClientRequestID: clientRequestID,
		BazarID:         bazarID,
		SellerID:        userID,
		SellerName:      sellerName,
		Items:           items,
		PaymentMethod:   paymentMethod,
		Notes:           req.Notes,
	})
	if err != nil {
		return nil, err
	}

	s.syncSaleAsync(organizationID, result.Sale)
	return result, nil
}

func (s *Service) CancelSale(
	ctx context.Context,
	organizationID string,
	saleID, userID uuid.UUID,
	canCancelAny bool,
) (*Sale, error) {
	sale, err := s.repo.CancelSale(ctx, organizationID, saleID, userID, canCancelAny)
	if err != nil {
		return nil, err
	}
	s.syncSaleAsync(organizationID, sale)
	return sale, nil
}

func (s *Service) SyncAll(ctx context.Context, organizationID string) (*SyncResult, error) {
	s.syncMu.Lock()
	defer s.syncMu.Unlock()

	if configured, message := s.sheets.Configured(); !configured {
		return nil, &serviceError{Status: http.StatusServiceUnavailable, Message: message}
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

	imported, err := s.syncProducts(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("sincronizar productos: %w", err)
	}
	result.ProductsImported = imported
	return result, nil
}

func (s *Service) syncSaleAsync(organizationID string, sale *Sale) {
	if sale == nil {
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

func (s *Service) DailyStats(ctx context.Context, organizationID string, bazarID *uuid.UUID) (*DailyStats, error) {
	now := time.Now().In(s.location)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, s.location)
	return s.repo.GetDailyStats(ctx, organizationID, bazarID, start, start.AddDate(0, 0, 1))
}
