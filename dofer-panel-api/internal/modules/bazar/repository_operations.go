package bazar

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Repository) UpdateProduct(
	ctx context.Context,
	organizationID string,
	productID uuid.UUID,
	product updateProductCommand,
) (*Product, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE products
		SET sku = $1,
		    name = $2,
		    category = $3,
		    suggested_price = $4,
		    cost = $5,
		    image_url = $6,
		    is_active = $7,
		    stock_sync_policy = $8,
		    bazar_source = 'manual',
		    updated_at = NOW()
		WHERE id = $9 AND organization_id = $10 AND bazar_enabled = TRUE
		RETURNING id, sku, name, COALESCE(category, ''), COALESCE(suggested_price, 0),
		          cost, stock, image_url, is_active, sheet_row, sheet_synced_at,
		          bazar_source, stock_sync_policy
	`,
		product.SKU,
		product.Name,
		product.Category,
		product.Price,
		product.Cost,
		product.ImageURL,
		product.Active,
		product.SyncPolicy,
		productID,
		organizationID,
	)

	updated, err := scanProduct(row)
	if err == pgx.ErrNoRows {
		return nil, &serviceError{Status: http.StatusNotFound, Message: "Producto no encontrado."}
	}
	if isUniqueViolation(err) {
		return nil, &serviceError{Status: http.StatusConflict, Message: "Ya existe un producto con ese código SKU."}
	}
	return updated, err
}

func (r *Repository) AdjustStock(
	ctx context.Context,
	organizationID string,
	command adjustStockCommand,
) (*Product, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var stockBefore int
	var productName string
	err = tx.QueryRow(ctx, `
		SELECT stock, name
		FROM products
		WHERE id = $1 AND organization_id = $2 AND bazar_enabled = TRUE
		FOR UPDATE
	`, command.ProductID, organizationID).Scan(&stockBefore, &productName)
	if err == pgx.ErrNoRows {
		return nil, &serviceError{Status: http.StatusNotFound, Message: "Producto no encontrado."}
	}
	if err != nil {
		return nil, err
	}

	stockAfter := stockBefore + command.Delta
	if stockAfter < 0 {
		return nil, &serviceError{
			Status:  http.StatusConflict,
			Message: fmt.Sprintf("Stock insuficiente para %s. Disponibles: %d.", productName, stockBefore),
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE products
		SET stock = $1, stock_sync_policy = 'manual', updated_at = NOW()
		WHERE id = $2 AND organization_id = $3
	`, stockAfter, command.ProductID, organizationID); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO bazar_inventory_movements (
			organization_id, product_id, bazar_id, movement_type, quantity,
			stock_before, stock_after, reason, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`,
		organizationID,
		command.ProductID,
		command.BazarID,
		command.MovementType,
		command.Delta,
		stockBefore,
		stockAfter,
		command.Reason,
		command.ActorID,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetProduct(ctx, organizationID, command.ProductID)
}

func (r *Repository) ListInventoryMovements(
	ctx context.Context,
	organizationID string,
	productID, bazarID *uuid.UUID,
	limit int,
) ([]InventoryMovement, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	query := `
		SELECT m.id, m.product_id, p.name, m.bazar_id, b.name, m.movement_type,
		       m.quantity, m.stock_before, m.stock_after, m.reason,
		       COALESCE(u.full_name, u.email, 'Sistema'), m.created_at
		FROM bazar_inventory_movements m
		JOIN products p ON p.id = m.product_id
		LEFT JOIN bazaars b ON b.id = m.bazar_id
		LEFT JOIN users u ON u.id = m.created_by
		WHERE m.organization_id = $1
	`
	args := []any{organizationID}
	if productID != nil {
		args = append(args, *productID)
		query += fmt.Sprintf(" AND m.product_id = $%d", len(args))
	}
	if bazarID != nil {
		args = append(args, *bazarID)
		query += fmt.Sprintf(" AND m.bazar_id = $%d", len(args))
	}
	args = append(args, limit)
	query += fmt.Sprintf(" ORDER BY m.created_at DESC LIMIT $%d", len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	movements := make([]InventoryMovement, 0)
	for rows.Next() {
		var item InventoryMovement
		var nullableBazarID uuid.NullUUID
		var bazarName, reason sql.NullString
		if err := rows.Scan(
			&item.ID,
			&item.ProductID,
			&item.ProductName,
			&nullableBazarID,
			&bazarName,
			&item.MovementType,
			&item.Quantity,
			&item.StockBefore,
			&item.StockAfter,
			&reason,
			&item.ActorName,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		if nullableBazarID.Valid {
			item.BazarID = &nullableBazarID.UUID
		}
		if bazarName.Valid {
			item.BazarName = &bazarName.String
		}
		if reason.Valid {
			item.Reason = &reason.String
		}
		movements = append(movements, item)
	}
	return movements, rows.Err()
}

func (r *Repository) GetBazar(ctx context.Context, organizationID string, bazarID uuid.UUID) (*Bazar, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, name, location, status, default_payment_method, starts_at, ends_at,
		       opening_cash, expected_cash, closing_cash, cash_difference, closing_notes
		FROM bazaars
		WHERE id = $1 AND organization_id = $2
	`, bazarID, organizationID)
	item, err := scanBazar(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return item, err
}

func (r *Repository) CloseBazar(
	ctx context.Context,
	organizationID string,
	bazarID, userID uuid.UUID,
	closingCash float64,
	notes *string,
) (*Bazar, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var status string
	var openingCash float64
	err = tx.QueryRow(ctx, `
		SELECT status, opening_cash
		FROM bazaars
		WHERE id = $1 AND organization_id = $2
		FOR UPDATE
	`, bazarID, organizationID).Scan(&status, &openingCash)
	if err == pgx.ErrNoRows {
		return nil, &serviceError{Status: http.StatusNotFound, Message: "Bazar no encontrado."}
	}
	if err != nil {
		return nil, err
	}
	if status != "active" {
		return nil, &serviceError{Status: http.StatusConflict, Message: "El bazar ya está cerrado."}
	}

	var cashSales float64
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(total), 0)
		FROM bazar_sales
		WHERE organization_id = $1
		  AND bazar_id = $2
		  AND status = 'completed'
		  AND payment_method = 'cash'
	`, organizationID, bazarID).Scan(&cashSales); err != nil {
		return nil, err
	}
	expectedCash := openingCash + cashSales
	difference := closingCash - expectedCash

	_, err = tx.Exec(ctx, `
		UPDATE bazaars
		SET status = 'closed',
		    ends_at = NOW(),
		    expected_cash = $1,
		    closing_cash = $2,
		    cash_difference = $3,
		    closing_notes = $4,
		    closed_by = $5,
		    updated_at = NOW()
		WHERE id = $6 AND organization_id = $7
	`, expectedCash, closingCash, difference, notes, userID, bazarID, organizationID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetBazar(ctx, organizationID, bazarID)
}

func (r *Repository) GetReport(
	ctx context.Context,
	organizationID string,
	bazarID *uuid.UUID,
	from, to time.Time,
) (*BazarReport, error) {
	report := &BazarReport{
		Date:           from.Format("2006-01-02"),
		From:           from,
		To:             to,
		PaymentMethods: make([]PaymentSummary, 0),
		Products:       make([]ProductSummary, 0),
		Sellers:        make([]SellerSummary, 0),
	}

	filter := ""
	args := []any{organizationID, from, to}
	if bazarID != nil {
		args = append(args, *bazarID)
		filter = fmt.Sprintf(" AND s.bazar_id = $%d", len(args))
		bazarItem, err := r.GetBazar(ctx, organizationID, *bazarID)
		if err != nil {
			return nil, err
		}
		if bazarItem == nil {
			return nil, &serviceError{Status: http.StatusNotFound, Message: "Bazar no encontrado."}
		}
		report.Bazar = bazarItem
		report.ExpectedCash = bazarItem.OpeningCash
		report.ClosingCash = bazarItem.ClosingCash
		report.CashDifference = bazarItem.CashDifference
	}

	summaryQuery := `
		SELECT
			COALESCE(SUM(s.total) FILTER (WHERE s.status = 'completed'), 0),
			COUNT(*) FILTER (WHERE s.status = 'completed'),
			COUNT(*) FILTER (WHERE s.status = 'cancelled')
		FROM bazar_sales s
		WHERE s.organization_id = $1 AND s.created_at >= $2 AND s.created_at < $3
	` + filter
	if err := r.db.QueryRow(ctx, summaryQuery, args...).Scan(
		&report.Total,
		&report.Operations,
		&report.CancelledSales,
	); err != nil {
		return nil, err
	}

	productQuantityQuery := `
		SELECT COALESCE(SUM(i.quantity), 0)
		FROM bazar_sale_items i
		JOIN bazar_sales s ON s.id = i.sale_id
		WHERE s.organization_id = $1 AND s.created_at >= $2 AND s.created_at < $3
		  AND s.status = 'completed'
	` + filter
	if err := r.db.QueryRow(ctx, productQuantityQuery, args...).Scan(&report.ProductsSold); err != nil {
		return nil, err
	}
	if report.Operations > 0 {
		report.AverageTicket = report.Total / float64(report.Operations)
	}

	paymentRows, err := r.db.Query(ctx, `
		SELECT s.payment_method, COUNT(*), COALESCE(SUM(s.total), 0)
		FROM bazar_sales s
		WHERE s.organization_id = $1 AND s.created_at >= $2 AND s.created_at < $3
		  AND s.status = 'completed'
	`+filter+`
		GROUP BY s.payment_method
		ORDER BY SUM(s.total) DESC
	`, args...)
	if err != nil {
		return nil, err
	}
	for paymentRows.Next() {
		var item PaymentSummary
		if err := paymentRows.Scan(&item.Method, &item.Operations, &item.Total); err != nil {
			paymentRows.Close()
			return nil, err
		}
		report.PaymentMethods = append(report.PaymentMethods, item)
		if item.Method == PaymentCash {
			report.ExpectedCash += item.Total
		}
	}
	if err := paymentRows.Err(); err != nil {
		paymentRows.Close()
		return nil, err
	}
	paymentRows.Close()

	productRows, err := r.db.Query(ctx, `
		SELECT i.product_id, i.product_external_id, i.product_name,
		       SUM(i.quantity), COALESCE(SUM(i.total), 0)
		FROM bazar_sale_items i
		JOIN bazar_sales s ON s.id = i.sale_id
		WHERE s.organization_id = $1 AND s.created_at >= $2 AND s.created_at < $3
		  AND s.status = 'completed'
	`+filter+`
		GROUP BY i.product_id, i.product_external_id, i.product_name
		ORDER BY SUM(i.quantity) DESC, i.product_name
	`, args...)
	if err != nil {
		return nil, err
	}
	for productRows.Next() {
		var item ProductSummary
		if err := productRows.Scan(
			&item.ProductID,
			&item.ExternalID,
			&item.ProductName,
			&item.Quantity,
			&item.Total,
		); err != nil {
			productRows.Close()
			return nil, err
		}
		report.Products = append(report.Products, item)
	}
	if err := productRows.Err(); err != nil {
		productRows.Close()
		return nil, err
	}
	productRows.Close()

	sellerRows, err := r.db.Query(ctx, `
		SELECT s.seller_name, COUNT(DISTINCT s.id), COALESCE(SUM(i.quantity), 0),
		       COALESCE(SUM(i.total), 0)
		FROM bazar_sales s
		JOIN bazar_sale_items i ON i.sale_id = s.id
		WHERE s.organization_id = $1 AND s.created_at >= $2 AND s.created_at < $3
		  AND s.status = 'completed'
	`+filter+`
		GROUP BY s.seller_name
		ORDER BY SUM(i.total) DESC, s.seller_name
	`, args...)
	if err != nil {
		return nil, err
	}
	defer sellerRows.Close()
	for sellerRows.Next() {
		var item SellerSummary
		if err := sellerRows.Scan(&item.SellerName, &item.Operations, &item.Quantity, &item.Total); err != nil {
			return nil, err
		}
		report.Sellers = append(report.Sellers, item)
	}
	return report, sellerRows.Err()
}

func (r *Repository) RecordAudit(
	ctx context.Context,
	organizationID string,
	bazarID *uuid.UUID,
	actorID uuid.UUID,
	actorName, action, entityType string,
	entityID *uuid.UUID,
	details any,
) error {
	if strings.TrimSpace(actorName) == "" {
		actorName = "Sistema"
	}
	encoded, err := json.Marshal(details)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(ctx, `
		INSERT INTO bazar_audit_logs (
			organization_id, bazar_id, actor_id, actor_name, action,
			entity_type, entity_id, details
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, organizationID, bazarID, actorID, actorName, action, entityType, entityID, encoded)
	return err
}

func (r *Repository) ListAudit(
	ctx context.Context,
	organizationID string,
	bazarID *uuid.UUID,
	limit int,
) ([]AuditLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 80
	}
	query := `
		SELECT id, bazar_id, actor_id, actor_name, action, entity_type,
		       entity_id, details, created_at
		FROM bazar_audit_logs
		WHERE organization_id = $1
	`
	args := []any{organizationID}
	if bazarID != nil {
		args = append(args, *bazarID)
		query += fmt.Sprintf(" AND bazar_id = $%d", len(args))
	}
	args = append(args, limit)
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]AuditLog, 0)
	for rows.Next() {
		var item AuditLog
		var bazarIDValue, actorID, entityID uuid.NullUUID
		if err := rows.Scan(
			&item.ID,
			&bazarIDValue,
			&actorID,
			&item.ActorName,
			&item.Action,
			&item.EntityType,
			&entityID,
			&item.Details,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		if bazarIDValue.Valid {
			item.BazarID = &bazarIDValue.UUID
		}
		if actorID.Valid {
			item.ActorID = &actorID.UUID
		}
		if entityID.Valid {
			item.EntityID = &entityID.UUID
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) FindSyncConflicts(
	ctx context.Context,
	organizationID string,
	sheetProducts []sheetProduct,
) ([]SyncConflict, error) {
	sheetBySKU := make(map[string]sheetProduct, len(sheetProducts))
	skus := make([]string, 0, len(sheetProducts))
	for _, product := range sheetProducts {
		sheetBySKU[product.ExternalID] = product
		skus = append(skus, product.ExternalID)
	}
	if len(skus) == 0 {
		return []SyncConflict{}, nil
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, sku, name, stock, COALESCE(suggested_price, 0)
		FROM products
		WHERE organization_id = $1
		  AND bazar_enabled = TRUE
		  AND stock_sync_policy = 'manual'
		  AND sku = ANY($2)
		  AND NOT EXISTS (
			  SELECT 1
			  FROM bazar_sale_items pending_item
			  JOIN bazar_sales pending_sale ON pending_sale.id = pending_item.sale_id
			  WHERE pending_item.product_id = products.id
			    AND pending_sale.organization_id = products.organization_id
			    AND pending_sale.sync_status <> 'synced'
		  )
		ORDER BY name
	`, organizationID, skus)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conflicts := make([]SyncConflict, 0)
	for rows.Next() {
		var item SyncConflict
		if err := rows.Scan(
			&item.ProductID,
			&item.ExternalID,
			&item.ProductName,
			&item.LocalStock,
			&item.LocalPrice,
		); err != nil {
			return nil, err
		}
		sheet := sheetBySKU[item.ExternalID]
		item.SheetStock = sheet.Stock
		item.SheetPrice = sheet.Price
		if item.LocalStock != item.SheetStock {
			conflicts = append(conflicts, item)
		}
	}
	return conflicts, rows.Err()
}
