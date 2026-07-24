package bazar

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListBazaars(ctx context.Context, organizationID string) ([]Bazar, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, location, status, default_payment_method, starts_at, ends_at,
		       opening_cash, expected_cash, closing_cash, cash_difference, closing_notes
		FROM bazaars
		WHERE organization_id = $1 AND status <> 'archived'
		ORDER BY (status = 'active') DESC, starts_at DESC
	`, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]Bazar, 0)
	for rows.Next() {
		bazarItem, err := scanBazar(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, *bazarItem)
	}
	return result, rows.Err()
}

func (r *Repository) CreateBazar(ctx context.Context, organizationID string, userID uuid.UUID, req CreateBazarRequest) (*Bazar, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: "El nombre del bazar es obligatorio."}
	}
	if req.OpeningCash < 0 || req.OpeningCash > 999999999 {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: "El efectivo inicial no es válido."}
	}

	paymentMethod := normalizePaymentMethod(req.DefaultPaymentMethod)
	if paymentMethod == "" {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: "El método de pago predeterminado no es válido."}
	}

	row := r.db.QueryRow(ctx, `
		INSERT INTO bazaars (
			organization_id, name, location, default_payment_method, opening_cash, created_by
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, location, status, default_payment_method, starts_at, ends_at,
		          opening_cash, expected_cash, closing_cash, cash_difference, closing_notes
	`, organizationID, name, sanitizeString(req.Location), paymentMethod, req.OpeningCash, userID)

	return scanBazar(row)
}

func scanBazar(row pgx.Row) (*Bazar, error) {
	var item Bazar
	var location sql.NullString
	var endsAt sql.NullTime
	var expectedCash, closingCash, cashDifference sql.NullFloat64
	var closingNotes sql.NullString
	if err := row.Scan(
		&item.ID,
		&item.Name,
		&location,
		&item.Status,
		&item.DefaultPaymentMethod,
		&item.StartsAt,
		&endsAt,
		&item.OpeningCash,
		&expectedCash,
		&closingCash,
		&cashDifference,
		&closingNotes,
	); err != nil {
		return nil, err
	}
	if location.Valid {
		item.Location = &location.String
	}
	if endsAt.Valid {
		item.EndsAt = &endsAt.Time
	}
	if expectedCash.Valid {
		item.ExpectedCash = &expectedCash.Float64
	}
	if closingCash.Valid {
		item.ClosingCash = &closingCash.Float64
	}
	if cashDifference.Valid {
		item.CashDifference = &cashDifference.Float64
	}
	if closingNotes.Valid {
		item.ClosingNotes = &closingNotes.String
	}
	return &item, nil
}

func (r *Repository) ListProducts(ctx context.Context, organizationID, query, category string) ([]Product, error) {
	sqlQuery := `
		SELECT id, sku, name, COALESCE(category, ''), COALESCE(suggested_price, 0),
		       cost, stock, image_url, is_active, sheet_row, sheet_synced_at,
		       bazar_source, stock_sync_policy, track_stock
		FROM products
		WHERE organization_id = $1 AND bazar_enabled = TRUE
	`
	args := []any{organizationID}

	if query = strings.TrimSpace(query); query != "" {
		args = append(args, "%"+query+"%")
		sqlQuery += fmt.Sprintf(
			" AND (name ILIKE $%d OR sku ILIKE $%d OR COALESCE(category, '') ILIKE $%d)",
			len(args), len(args), len(args),
		)
	}
	if category = strings.TrimSpace(category); category != "" {
		args = append(args, category)
		sqlQuery += fmt.Sprintf(" AND category = $%d", len(args))
	}
	sqlQuery += " ORDER BY is_active DESC, (NOT track_stock OR stock > 0) DESC, category, name"

	rows, err := r.db.Query(ctx, sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]Product, 0)
	for rows.Next() {
		product, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		products = append(products, *product)
	}
	return products, rows.Err()
}

func (r *Repository) GetProduct(ctx context.Context, organizationID string, productID uuid.UUID) (*Product, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, sku, name, COALESCE(category, ''), COALESCE(suggested_price, 0),
		       cost, stock, image_url, is_active, sheet_row, sheet_synced_at,
		       bazar_source, stock_sync_policy, track_stock
		FROM products
		WHERE organization_id = $1 AND id = $2 AND bazar_enabled = TRUE
	`, organizationID, productID)
	product, err := scanProduct(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return product, err
}

func scanProduct(row pgx.Row) (*Product, error) {
	var product Product
	var cost sql.NullFloat64
	var imageURL sql.NullString
	var sheetRow sql.NullInt32
	var sheetSyncedAt sql.NullTime
	if err := row.Scan(
		&product.ID,
		&product.ExternalID,
		&product.Name,
		&product.Category,
		&product.Price,
		&cost,
		&product.Stock,
		&imageURL,
		&product.Active,
		&sheetRow,
		&sheetSyncedAt,
		&product.Source,
		&product.SyncPolicy,
		&product.TrackStock,
	); err != nil {
		return nil, err
	}
	if cost.Valid {
		product.Cost = &cost.Float64
	}
	if imageURL.Valid {
		product.ImageURL = &imageURL.String
	}
	if sheetRow.Valid {
		value := int(sheetRow.Int32)
		product.SheetRow = &value
	}
	if sheetSyncedAt.Valid {
		product.SheetSyncedAt = &sheetSyncedAt.Time
	}
	return &product, nil
}

func (r *Repository) CreateManualProduct(
	ctx context.Context,
	organizationID string,
	product createProductCommand,
) (*Product, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO products (
			id, organization_id, sku, name, category, suggested_price, cost, stock,
			image_url, is_active, bazar_enabled, bazar_source, stock_sync_policy, track_stock
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, TRUE, 'manual', 'manual', $10)
		ON CONFLICT (id) DO NOTHING
		RETURNING id, sku, name, COALESCE(category, ''), COALESCE(suggested_price, 0),
		          cost, stock, image_url, is_active, sheet_row, sheet_synced_at,
		          bazar_source, stock_sync_policy, track_stock
	`,
		product.ID,
		organizationID,
		product.SKU,
		product.Name,
		product.Category,
		product.Price,
		product.Cost,
		product.Stock,
		product.ImageURL,
		product.TrackStock,
	)

	created, err := scanProduct(row)
	if err == pgx.ErrNoRows {
		existing, getErr := r.GetProduct(ctx, organizationID, product.ID)
		if getErr != nil {
			return nil, getErr
		}
		if existing == nil {
			return nil, &serviceError{Status: http.StatusConflict, Message: "El ID del producto ya está en uso."}
		}
		return existing, nil
	}
	if isUniqueViolation(err) {
		return nil, &serviceError{Status: http.StatusConflict, Message: "Ya existe un producto con ese código SKU."}
	}
	return created, err
}

func (r *Repository) UpsertSheetProducts(
	ctx context.Context,
	organizationID string,
	products []sheetProduct,
	conflictStrategy string,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, product := range products {
		_, err := tx.Exec(ctx, `
			INSERT INTO products (
				organization_id, sku, name, category, suggested_price, cost, stock,
				image_url, is_active, bazar_enabled, sheet_row, sheet_synced_at,
				bazar_source, stock_sync_policy
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, NOW(), 'sheets', 'sheets')
			ON CONFLICT (organization_id, sku) DO UPDATE SET
				name = CASE WHEN products.bazar_source = 'manual' THEN products.name ELSE EXCLUDED.name END,
				category = CASE WHEN products.bazar_source = 'manual' THEN products.category ELSE EXCLUDED.category END,
				suggested_price = CASE WHEN products.bazar_source = 'manual' THEN products.suggested_price ELSE EXCLUDED.suggested_price END,
				cost = CASE WHEN products.bazar_source = 'manual' THEN products.cost ELSE EXCLUDED.cost END,
				stock = CASE
					WHEN EXISTS (
						SELECT 1
						FROM bazar_sale_items pending_item
						JOIN bazar_sales pending_sale ON pending_sale.id = pending_item.sale_id
						WHERE pending_item.product_id = products.id
						  AND pending_sale.organization_id = products.organization_id
						  AND pending_sale.sync_status <> 'synced'
					) THEN products.stock
					WHEN products.stock_sync_policy = 'manual' AND $11 = 'keep_manual' THEN products.stock
					ELSE EXCLUDED.stock
				END,
				image_url = CASE WHEN products.bazar_source = 'manual' THEN products.image_url ELSE EXCLUDED.image_url END,
				is_active = CASE WHEN products.bazar_source = 'manual' THEN products.is_active ELSE EXCLUDED.is_active END,
				bazar_enabled = TRUE,
				sheet_row = EXCLUDED.sheet_row,
				sheet_synced_at = NOW(),
				bazar_source = CASE WHEN products.bazar_source = 'manual' THEN 'manual' ELSE 'sheets' END,
				stock_sync_policy = CASE WHEN products.stock_sync_policy = 'manual' AND $11 = 'keep_manual' THEN 'manual' ELSE 'sheets' END,
				updated_at = NOW()
		`,
			organizationID,
			product.ExternalID,
			product.Name,
			product.Category,
			product.Price,
			product.Cost,
			product.Stock,
			product.ImageURL,
			product.Active,
			product.SheetRow,
			conflictStrategy,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *Repository) CreateSale(ctx context.Context, organizationID string, cmd createSaleCommand) (*CreateSaleResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		SELECT pg_advisory_xact_lock(hashtextextended($1, 0))
	`, organizationID+":"+cmd.ClientRequestID.String()); err != nil {
		return nil, err
	}

	var existingID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT id FROM bazar_sales
		WHERE organization_id = $1 AND client_request_id = $2
	`, organizationID, cmd.ClientRequestID).Scan(&existingID)
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		existing, err := r.GetSale(ctx, organizationID, existingID)
		return &CreateSaleResult{Sale: existing, Duplicated: true}, err
	}
	if err != pgx.ErrNoRows {
		return nil, err
	}

	var bazarName, bazarStatus string
	if err := tx.QueryRow(ctx, `
		SELECT name, status FROM bazaars
		WHERE id = $1 AND organization_id = $2
		FOR UPDATE
	`, cmd.BazarID, organizationID).Scan(&bazarName, &bazarStatus); err != nil {
		if err == pgx.ErrNoRows {
			return nil, &serviceError{Status: http.StatusNotFound, Message: "Bazar no encontrado."}
		}
		return nil, err
	}
	if bazarStatus != "active" {
		return nil, &serviceError{Status: http.StatusConflict, Message: "La sesión del bazar está cerrada."}
	}

	type lockedProduct struct {
		ID         uuid.UUID
		ExternalID string
		Name       string
		Price      float64
		Stock      int
		TrackStock bool
	}
	lockedProducts := make([]lockedProduct, 0, len(cmd.Items))
	total := 0.0

	for _, item := range cmd.Items {
		var product lockedProduct
		var active, bazarEnabled bool
		err := tx.QueryRow(ctx, `
			SELECT id, sku, name, COALESCE(suggested_price, 0), stock, track_stock,
			       is_active, bazar_enabled
			FROM products
			WHERE id = $1 AND organization_id = $2
			FOR UPDATE
		`, item.ProductID, organizationID).Scan(
			&product.ID,
			&product.ExternalID,
			&product.Name,
			&product.Price,
			&product.Stock,
			&product.TrackStock,
			&active,
			&bazarEnabled,
		)
		if err == pgx.ErrNoRows || !bazarEnabled {
			return nil, &serviceError{Status: http.StatusNotFound, Message: "Producto no encontrado."}
		}
		if err != nil {
			return nil, err
		}
		if !active {
			return nil, &serviceError{Status: http.StatusConflict, Message: product.Name + " está inactivo."}
		}
		if product.TrackStock && item.Quantity > product.Stock {
			return nil, &serviceError{
				Status:  http.StatusConflict,
				Message: fmt.Sprintf("Stock insuficiente para %s. Disponibles: %d.", product.Name, product.Stock),
			}
		}
		total += product.Price * float64(item.Quantity)
		lockedProducts = append(lockedProducts, product)
	}

	saleID := uuid.New()
	externalID := fmt.Sprintf(
		"SALE-%s-%s",
		time.Now().Format("20060102"),
		strings.ToUpper(strings.ReplaceAll(saleID.String(), "-", "")[:8]),
	)
	notes := sanitizeString(cmd.Notes)
	var cashReceived, changeDue *float64
	if cmd.PaymentMethod == PaymentCash && cmd.CashReceived != nil {
		if *cmd.CashReceived < total {
			return nil, &serviceError{
				Status:  http.StatusBadRequest,
				Message: fmt.Sprintf("El efectivo recibido debe ser al menos %.2f.", total),
			}
		}
		received := *cmd.CashReceived
		change := received - total
		cashReceived = &received
		changeDue = &change
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO bazar_sales (
			id, organization_id, external_id, client_request_id, bazar_id,
			seller_id, seller_name, subtotal, total, payment_method,
			cash_received, change_due, notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12)
	`,
		saleID,
		organizationID,
		externalID,
		cmd.ClientRequestID,
		cmd.BazarID,
		cmd.SellerID,
		cmd.SellerName,
		total,
		cmd.PaymentMethod,
		cashReceived,
		changeDue,
		notes,
	)
	if err != nil {
		return nil, err
	}

	for index, item := range cmd.Items {
		product := lockedProducts[index]
		stockAfter := product.Stock
		if product.TrackStock {
			stockAfter -= item.Quantity
		}
		lineTotal := product.Price * float64(item.Quantity)

		if product.TrackStock {
			if _, err := tx.Exec(ctx, `
				UPDATE products
				SET stock = $1, updated_at = NOW()
				WHERE id = $2 AND organization_id = $3
			`, stockAfter, product.ID, organizationID); err != nil {
				return nil, err
			}
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO bazar_sale_items (
				organization_id, sale_id, product_id, product_external_id, product_name,
				quantity, unit_price, total, stock_before, stock_after
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`,
			organizationID,
			saleID,
			product.ID,
			product.ExternalID,
			product.Name,
			item.Quantity,
			product.Price,
			lineTotal,
			product.Stock,
			stockAfter,
		); err != nil {
			return nil, err
		}

		if product.TrackStock {
			if _, err := tx.Exec(ctx, `
				INSERT INTO bazar_inventory_movements (
					organization_id, product_id, sale_id, bazar_id, movement_type,
					quantity, stock_before, stock_after, reason, created_by
				) VALUES ($1, $2, $3, $4, 'sale', $5, $6, $7, 'Venta de bazar', $8)
			`,
				organizationID,
				product.ID,
				saleID,
				cmd.BazarID,
				-item.Quantity,
				product.Stock,
				stockAfter,
				cmd.SellerID,
			); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	sale, err := r.GetSale(ctx, organizationID, saleID)
	if err != nil {
		return nil, err
	}
	return &CreateSaleResult{Sale: sale}, nil
}

func (r *Repository) GetSale(ctx context.Context, organizationID string, saleID uuid.UUID) (*Sale, error) {
	row := r.db.QueryRow(ctx, `
		SELECT s.id, s.external_id, s.client_request_id, s.bazar_id, b.name,
		       s.seller_id, s.seller_name, s.subtotal, s.total, s.payment_method,
		       s.cash_received, s.change_due,
		       s.status, s.sync_status, s.sync_attempts, s.last_sync_at,
		       s.sync_error, s.notes, s.created_at, s.cancelled_at
		FROM bazar_sales s
		JOIN bazaars b ON b.id = s.bazar_id
		WHERE s.id = $1 AND s.organization_id = $2
	`, saleID, organizationID)

	sale, err := scanSale(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	items, err := r.listSaleItems(ctx, organizationID, sale.ID)
	if err != nil {
		return nil, err
	}
	sale.Items = items
	return sale, nil
}

func (r *Repository) ListSales(ctx context.Context, organizationID string, bazarID *uuid.UUID, limit int) ([]Sale, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}

	query := `
		SELECT s.id, s.external_id, s.client_request_id, s.bazar_id, b.name,
		       s.seller_id, s.seller_name, s.subtotal, s.total, s.payment_method,
		       s.cash_received, s.change_due,
		       s.status, s.sync_status, s.sync_attempts, s.last_sync_at,
		       s.sync_error, s.notes, s.created_at, s.cancelled_at
		FROM bazar_sales s
		JOIN bazaars b ON b.id = s.bazar_id
		WHERE s.organization_id = $1
	`
	args := []any{organizationID}
	if bazarID != nil {
		args = append(args, *bazarID)
		query += fmt.Sprintf(" AND s.bazar_id = $%d", len(args))
	}
	args = append(args, limit)
	query += fmt.Sprintf(" ORDER BY s.created_at DESC LIMIT $%d", len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sales := make([]Sale, 0)
	for rows.Next() {
		sale, err := scanSale(rows)
		if err != nil {
			return nil, err
		}
		sales = append(sales, *sale)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for index := range sales {
		items, err := r.listSaleItems(ctx, organizationID, sales[index].ID)
		if err != nil {
			return nil, err
		}
		sales[index].Items = items
	}
	return sales, nil
}

func scanSale(row pgx.Row) (*Sale, error) {
	var sale Sale
	var sellerID uuid.NullUUID
	var lastSyncAt, cancelledAt sql.NullTime
	var syncError, notes sql.NullString
	var cashReceived, changeDue sql.NullFloat64
	if err := row.Scan(
		&sale.ID,
		&sale.ExternalID,
		&sale.ClientRequestID,
		&sale.BazarID,
		&sale.BazarName,
		&sellerID,
		&sale.SellerName,
		&sale.Subtotal,
		&sale.Total,
		&sale.PaymentMethod,
		&cashReceived,
		&changeDue,
		&sale.Status,
		&sale.SyncStatus,
		&sale.SyncAttempts,
		&lastSyncAt,
		&syncError,
		&notes,
		&sale.CreatedAt,
		&cancelledAt,
	); err != nil {
		return nil, err
	}
	if sellerID.Valid {
		sale.SellerID = &sellerID.UUID
	}
	if cashReceived.Valid {
		sale.CashReceived = &cashReceived.Float64
	}
	if changeDue.Valid {
		sale.ChangeDue = &changeDue.Float64
	}
	if lastSyncAt.Valid {
		sale.LastSyncAt = &lastSyncAt.Time
	}
	if syncError.Valid {
		sale.SyncError = &syncError.String
	}
	if notes.Valid {
		sale.Notes = &notes.String
	}
	if cancelledAt.Valid {
		sale.CancelledAt = &cancelledAt.Time
	}
	sale.Items = make([]SaleItem, 0)
	return &sale, nil
}

func (r *Repository) listSaleItems(ctx context.Context, organizationID string, saleID uuid.UUID) ([]SaleItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, product_id, product_external_id, product_name, quantity,
		       unit_price, total, stock_before, stock_after
		FROM bazar_sale_items
		WHERE sale_id = $1 AND organization_id = $2
		ORDER BY created_at, id
	`, saleID, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]SaleItem, 0)
	for rows.Next() {
		var item SaleItem
		if err := rows.Scan(
			&item.ID,
			&item.ProductID,
			&item.ProductExternalID,
			&item.ProductName,
			&item.Quantity,
			&item.UnitPrice,
			&item.Total,
			&item.StockBefore,
			&item.StockAfter,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) CancelSale(
	ctx context.Context,
	organizationID string,
	saleID, userID uuid.UUID,
	canCancelAny bool,
) (*Sale, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var status string
	var sellerID uuid.NullUUID
	var bazarID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT status, seller_id, bazar_id
		FROM bazar_sales
		WHERE id = $1 AND organization_id = $2
		FOR UPDATE
	`, saleID, organizationID).Scan(&status, &sellerID, &bazarID)
	if err == pgx.ErrNoRows {
		return nil, &serviceError{Status: http.StatusNotFound, Message: "Venta no encontrada."}
	}
	if err != nil {
		return nil, err
	}
	if status == "cancelled" {
		return nil, &serviceError{Status: http.StatusConflict, Message: "La venta ya está cancelada."}
	}
	if !canCancelAny && (!sellerID.Valid || sellerID.UUID != userID) {
		return nil, &serviceError{Status: http.StatusForbidden, Message: "Solo puedes deshacer tus propias ventas."}
	}

	rows, err := tx.Query(ctx, `
		SELECT product_id, quantity
		FROM bazar_sale_items
		WHERE sale_id = $1 AND organization_id = $2
		ORDER BY id
	`, saleID, organizationID)
	if err != nil {
		return nil, err
	}

	type cancellationItem struct {
		ProductID uuid.UUID
		Quantity  int
	}
	items := make([]cancellationItem, 0)
	for rows.Next() {
		var item cancellationItem
		if err := rows.Scan(&item.ProductID, &item.Quantity); err != nil {
			rows.Close()
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	for _, item := range items {
		var stockBefore int
		var trackStock bool
		if err := tx.QueryRow(ctx, `
			SELECT stock, track_stock FROM products
			WHERE id = $1 AND organization_id = $2
			FOR UPDATE
		`, item.ProductID, organizationID).Scan(&stockBefore, &trackStock); err != nil {
			return nil, err
		}
		if !trackStock {
			continue
		}
		stockAfter := stockBefore + item.Quantity
		if _, err := tx.Exec(ctx, `
			UPDATE products SET stock = $1, updated_at = NOW()
			WHERE id = $2 AND organization_id = $3
		`, stockAfter, item.ProductID, organizationID); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO bazar_inventory_movements (
				organization_id, product_id, sale_id, bazar_id, movement_type,
				quantity, stock_before, stock_after, reason, created_by
			) VALUES ($1, $2, $3, $4, 'sale_cancelled', $5, $6, $7, 'Venta cancelada', $8)
		`, organizationID, item.ProductID, saleID, bazarID, item.Quantity, stockBefore, stockAfter, userID); err != nil {
			return nil, err
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE bazar_sales
		SET status = 'cancelled',
		    sync_status = 'pending',
		    sync_error = NULL,
		    cancelled_at = NOW(),
		    cancelled_by = $1,
		    updated_at = NOW()
		WHERE id = $2 AND organization_id = $3
	`, userID, saleID, organizationID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetSale(ctx, organizationID, saleID)
}

func (r *Repository) GetCurrentStocksForSale(ctx context.Context, organizationID string, saleID uuid.UUID) (map[string]int, error) {
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT i.product_external_id, p.stock
		FROM bazar_sale_items i
		JOIN products p ON p.id = i.product_id AND p.organization_id = i.organization_id
		WHERE i.sale_id = $1 AND i.organization_id = $2
	`, saleID, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stocks := make(map[string]int)
	for rows.Next() {
		var externalID string
		var stock int
		if err := rows.Scan(&externalID, &stock); err != nil {
			return nil, err
		}
		stocks[externalID] = stock
	}
	return stocks, rows.Err()
}

func (r *Repository) MarkSaleSynced(ctx context.Context, organizationID string, saleID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE bazar_sales
		SET sync_status = 'synced',
		    sync_attempts = sync_attempts + 1,
		    last_sync_at = NOW(),
		    sync_error = NULL,
		    updated_at = NOW()
		WHERE id = $1 AND organization_id = $2
	`, saleID, organizationID)
	return err
}

func (r *Repository) MarkSaleSyncError(ctx context.Context, organizationID string, saleID uuid.UUID, syncErr error) error {
	message := "Error desconocido de sincronización"
	if syncErr != nil {
		message = syncErr.Error()
	}
	if len(message) > 1000 {
		message = message[:1000]
	}
	_, err := r.db.Exec(ctx, `
		UPDATE bazar_sales
		SET sync_status = 'error',
		    sync_attempts = sync_attempts + 1,
		    sync_error = $1,
		    updated_at = NOW()
		WHERE id = $2 AND organization_id = $3
	`, message, saleID, organizationID)
	return err
}

func (r *Repository) ListUnsyncedSales(ctx context.Context, organizationID string, limit int) ([]Sale, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, `
		SELECT id
		FROM bazar_sales
		WHERE organization_id = $1 AND sync_status IN ('pending', 'error')
		ORDER BY created_at
		LIMIT $2
	`, organizationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]uuid.UUID, 0)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	sales := make([]Sale, 0, len(ids))
	for _, id := range ids {
		sale, err := r.GetSale(ctx, organizationID, id)
		if err != nil {
			return nil, err
		}
		if sale != nil {
			sales = append(sales, *sale)
		}
	}
	return sales, nil
}

func (r *Repository) GetDailyStats(
	ctx context.Context,
	organizationID string,
	bazarID *uuid.UUID,
	start, end time.Time,
) (*DailyStats, error) {
	query := `
		SELECT
			COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'completed'), 0),
			MAX(created_at) FILTER (WHERE status = 'completed'),
			COALESCE(COUNT(*) FILTER (WHERE sync_status <> 'synced'), 0)
		FROM bazar_sales
		WHERE organization_id = $1 AND created_at >= $2 AND created_at < $3
	`
	args := []any{organizationID, start, end}
	if bazarID != nil {
		args = append(args, *bazarID)
		query += fmt.Sprintf(" AND bazar_id = $%d", len(args))
	}

	var stats DailyStats
	var lastSaleAt sql.NullTime
	if err := r.db.QueryRow(ctx, query, args...).Scan(
		&stats.Total,
		&stats.Operations,
		&lastSaleAt,
		&stats.PendingSync,
	); err != nil {
		return nil, err
	}
	if lastSaleAt.Valid {
		stats.LastSaleAt = &lastSaleAt.Time
	}

	itemsQuery := `
		SELECT COALESCE(SUM(i.quantity), 0)
		FROM bazar_sale_items i
		JOIN bazar_sales s ON s.id = i.sale_id
		WHERE s.organization_id = $1
		  AND s.created_at >= $2 AND s.created_at < $3
		  AND s.status = 'completed'
	`
	itemArgs := []any{organizationID, start, end}
	if bazarID != nil {
		itemArgs = append(itemArgs, *bazarID)
		itemsQuery += fmt.Sprintf(" AND s.bazar_id = $%d", len(itemArgs))
	}
	if err := r.db.QueryRow(ctx, itemsQuery, itemArgs...).Scan(&stats.ProductsSold); err != nil {
		return nil, err
	}
	if stats.Operations > 0 {
		stats.AverageTicket = stats.Total / float64(stats.Operations)
	}

	if err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE track_stock AND stock > 0 AND stock <= 2),
			COUNT(*) FILTER (WHERE track_stock AND stock = 0)
		FROM products
		WHERE organization_id = $1 AND bazar_enabled = TRUE AND is_active = TRUE
	`, organizationID).Scan(&stats.LowStockProducts, &stats.OutOfStock); err != nil {
		return nil, err
	}
	return &stats, nil
}

func (r *Repository) GetSyncStatus(ctx context.Context, organizationID string, configured bool, configurationMessage string) (*SyncStatus, error) {
	var status SyncStatus
	status.Configured = configured
	status.ConfigurationMsg = configurationMessage

	var lastProductSync, lastSaleSync sql.NullTime
	if err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE sync_status = 'pending'),
			COUNT(*) FILTER (WHERE sync_status = 'error'),
			MAX(last_sync_at),
			COALESCE((
				SELECT latest.sync_error
				FROM bazar_sales latest
				WHERE latest.organization_id = $1
				  AND latest.sync_status = 'error'
				  AND latest.sync_error IS NOT NULL
				ORDER BY latest.updated_at DESC
				LIMIT 1
			), '')
		FROM bazar_sales
		WHERE organization_id = $1
	`, organizationID).Scan(
		&status.PendingSales,
		&status.FailedSales,
		&lastSaleSync,
		&status.LastError,
	); err != nil {
		return nil, err
	}
	if err := r.db.QueryRow(ctx, `
		SELECT MAX(sheet_synced_at)
		FROM products
		WHERE organization_id = $1 AND bazar_enabled = TRUE
	`, organizationID).Scan(&lastProductSync); err != nil {
		return nil, err
	}

	if lastProductSync.Valid {
		status.LastProductSync = &lastProductSync.Time
	}
	if lastSaleSync.Valid {
		status.LastSaleSync = &lastSaleSync.Time
	}

	switch {
	case !configured:
		status.Status = "not_configured"
	case status.FailedSales > 0:
		status.Status = "error"
	case status.PendingSales > 0:
		status.Status = "pending"
	default:
		status.Status = "synced"
	}
	return &status, nil
}

func normalizePaymentMethod(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", PaymentCash:
		return PaymentCash
	case PaymentTransfer:
		return PaymentTransfer
	case PaymentCard:
		return PaymentCard
	case PaymentMercadoPago:
		return PaymentMercadoPago
	case PaymentOther:
		return PaymentOther
	default:
		return ""
	}
}

func sanitizeString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
