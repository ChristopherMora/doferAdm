package bazar

import (
	"context"
	"errors"
	"net/http"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type unconfiguredSheets struct{}

func (unconfiguredSheets) Configured() (bool, string) {
	return false, "Google Sheets no está configurado"
}

func (unconfiguredSheets) ReadProducts(context.Context) ([]sheetProduct, error) {
	return nil, errors.New("unexpected ReadProducts call")
}

func (unconfiguredSheets) SyncSale(context.Context, *Sale, map[string]int) error {
	return errors.New("unexpected SyncSale call")
}

func TestManualProductSaleLifecycleIntegration(t *testing.T) {
	databaseURL := os.Getenv("BAZAR_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BAZAR_TEST_DATABASE_URL is not configured")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect to test database: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("ping test database: %v", err)
	}

	userID := uuid.New()
	organizationID := uuid.New()
	_, err = pool.Exec(ctx, `
		INSERT INTO users (id, email, full_name, role)
		VALUES ($1, $2, 'Integration Admin', 'admin')
	`, userID, "bazar-"+userID.String()+"@example.com")
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO organizations (id, name, slug, created_by)
		VALUES ($1, 'Bazar Integration', $2, $3)
	`, organizationID, "bazar-"+organizationID.String(), userID)
	if err != nil {
		t.Fatalf("create test organization: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM bazar_audit_logs WHERE organization_id = $1", organizationID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM bazar_inventory_movements WHERE organization_id = $1", organizationID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM bazar_sale_items WHERE organization_id = $1", organizationID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM bazar_sales WHERE organization_id = $1", organizationID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM bazaars WHERE organization_id = $1", organizationID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM products WHERE organization_id = $1", organizationID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM organizations WHERE id = $1", organizationID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", userID)
	})

	repository := NewRepository(pool)
	service := NewService(repository, unconfiguredSheets{}, "America/Mexico_City")

	bazarItem, err := repository.CreateBazar(ctx, organizationID.String(), userID, CreateBazarRequest{
		Name:                 "Bazar de prueba",
		DefaultPaymentMethod: PaymentCash,
		OpeningCash:          100,
	})
	if err != nil {
		t.Fatalf("create bazar: %v", err)
	}
	product, err := service.CreateProduct(ctx, organizationID.String(), userID, "Integration Admin", CreateProductRequest{
		SKU:      "TEST-CAP-01",
		Name:     "Capibara café",
		Category: "Doflins",
		Price:    40,
		Stock:    12,
	})
	if err != nil {
		t.Fatalf("create product: %v", err)
	}

	_, err = service.CreateProduct(ctx, organizationID.String(), userID, "Integration Admin", CreateProductRequest{
		SKU:   product.ExternalID,
		Name:  "Producto duplicado",
		Price: 10,
		Stock: 1,
	})
	var duplicateError *serviceError
	if !errors.As(err, &duplicateError) || duplicateError.Status != http.StatusConflict {
		t.Fatalf("expected duplicate SKU conflict, got %v", err)
	}

	result, err := service.CreateSale(ctx, organizationID.String(), userID, "Integration Admin", CreateSaleRequest{
		ClientRequestID: uuid.NewString(),
		BazarID:         bazarItem.ID.String(),
		ProductID:       product.ID.String(),
		Quantity:        2,
		PaymentMethod:   PaymentCash,
	})
	if err != nil {
		t.Fatalf("create sale: %v", err)
	}
	if result.Sale.Total != 80 || result.Sale.SyncStatus != "pending" {
		t.Fatalf("unexpected sale: %#v", result.Sale)
	}
	if len(result.Sale.Items) != 1 || result.Sale.Items[0].StockAfter != 10 {
		t.Fatalf("unexpected sale items: %#v", result.Sale.Items)
	}

	updated, err := repository.GetProduct(ctx, organizationID.String(), product.ID)
	if err != nil {
		t.Fatalf("get sold product: %v", err)
	}
	if updated == nil || updated.Stock != 10 {
		t.Fatalf("expected stock 10 after sale, got %#v", updated)
	}

	cancelled, err := service.CancelSale(ctx, organizationID.String(), result.Sale.ID, userID, "Integration Admin", true)
	if err != nil {
		t.Fatalf("cancel sale: %v", err)
	}
	if cancelled.Status != "cancelled" || cancelled.SyncStatus != "pending" {
		t.Fatalf("unexpected cancelled sale: %#v", cancelled)
	}

	restored, err := repository.GetProduct(ctx, organizationID.String(), product.ID)
	if err != nil {
		t.Fatalf("get restored product: %v", err)
	}
	if restored == nil || restored.Stock != 12 {
		t.Fatalf("expected restored stock 12, got %#v", restored)
	}

	trackStock := false
	freeSaleProduct, err := service.CreateProduct(
		ctx,
		organizationID.String(),
		userID,
		"Integration Admin",
		CreateProductRequest{
			SKU:        "TEST-FREE-01",
			Name:       "Producto de venta libre",
			Price:      30,
			TrackStock: &trackStock,
		},
	)
	if err != nil {
		t.Fatalf("create free sale product: %v", err)
	}
	freeSale, err := service.CreateSale(ctx, organizationID.String(), userID, "Integration Admin", CreateSaleRequest{
		ClientRequestID: uuid.NewString(),
		BazarID:         bazarItem.ID.String(),
		ProductID:       freeSaleProduct.ID.String(),
		Quantity:        4,
		PaymentMethod:   PaymentTransfer,
	})
	if err != nil {
		t.Fatalf("create sale without stock tracking: %v", err)
	}
	if len(freeSale.Sale.Items) != 1 || freeSale.Sale.Items[0].StockBefore != 0 ||
		freeSale.Sale.Items[0].StockAfter != 0 {
		t.Fatalf("unexpected free sale stock: %#v", freeSale.Sale.Items)
	}
	_, err = service.CancelSale(
		ctx,
		organizationID.String(),
		freeSale.Sale.ID,
		userID,
		"Integration Admin",
		true,
	)
	if err != nil {
		t.Fatalf("cancel sale without stock tracking: %v", err)
	}
	freeSaleProduct, err = repository.GetProduct(ctx, organizationID.String(), freeSaleProduct.ID)
	if err != nil || freeSaleProduct == nil || freeSaleProduct.Stock != 0 || freeSaleProduct.TrackStock {
		t.Fatalf("free sale product changed stock mode: %#v, err=%v", freeSaleProduct, err)
	}

	secondProduct, err := service.CreateProduct(ctx, organizationID.String(), userID, "Integration Admin", CreateProductRequest{
		SKU:      "TEST-CAP-02",
		Name:     "Capibara rosa",
		Category: "Doflins",
		Price:    25,
		Stock:    5,
	})
	if err != nil {
		t.Fatalf("create second product: %v", err)
	}
	updatedName := "Capibara café grande"
	updatedPrice := 45.0
	manualPolicy := "manual"
	updatedProduct, err := service.UpdateProduct(
		ctx,
		organizationID.String(),
		userID,
		"Integration Admin",
		product.ID,
		UpdateProductRequest{
			Name:       &updatedName,
			Price:      &updatedPrice,
			SyncPolicy: &manualPolicy,
		},
	)
	if err != nil {
		t.Fatalf("update product: %v", err)
	}
	if updatedProduct.Name != updatedName || updatedProduct.Price != updatedPrice {
		t.Fatalf("unexpected updated product: %#v", updatedProduct)
	}

	adjustedProduct, err := service.AdjustStock(
		ctx,
		organizationID.String(),
		userID,
		"Integration Admin",
		product.ID,
		AdjustStockRequest{
			BazarID:      bazarItem.ID.String(),
			MovementType: "inventory_entry",
			Quantity:     3,
			Reason:       "Reposición",
		},
	)
	if err != nil {
		t.Fatalf("adjust product stock: %v", err)
	}
	if adjustedProduct.Stock != 15 {
		t.Fatalf("expected stock 15 after adjustment, got %d", adjustedProduct.Stock)
	}
	err = repository.UpsertSheetProducts(ctx, organizationID.String(), []sheetProduct{{
		ExternalID: product.ExternalID,
		Name:       "Nombre incompleto de Sheets",
		Category:   "",
		Price:      1,
		Stock:      999,
		Active:     true,
		SheetRow:   3,
	}}, "use_sheet")
	if err != nil {
		t.Fatalf("upsert manual product from sheets: %v", err)
	}
	preservedProduct, err := repository.GetProduct(ctx, organizationID.String(), product.ID)
	if err != nil {
		t.Fatalf("get preserved manual product: %v", err)
	}
	if preservedProduct == nil || preservedProduct.Name != updatedName || preservedProduct.Price != updatedPrice ||
		preservedProduct.Category != "Doflins" || preservedProduct.Stock != 15 {
		t.Fatalf("manual product metadata or pending stock was overwritten: %#v", preservedProduct)
	}

	_, err = pool.Exec(ctx, `
		UPDATE products
		SET bazar_source = 'sheets', stock_sync_policy = 'sheets'
		WHERE id = $1
	`, secondProduct.ID)
	if err != nil {
		t.Fatalf("prepare sheet product: %v", err)
	}
	secondProduct, err = service.AdjustStock(
		ctx,
		organizationID.String(),
		userID,
		"Integration Admin",
		secondProduct.ID,
		AdjustStockRequest{
			BazarID:      bazarItem.ID.String(),
			MovementType: "inventory_entry",
			Quantity:     1,
			Reason:       "Ajuste durante el evento",
		},
	)
	if err != nil {
		t.Fatalf("adjust sheet product stock: %v", err)
	}
	conflicts, err := repository.FindSyncConflicts(ctx, organizationID.String(), []sheetProduct{{
		ExternalID: secondProduct.ExternalID,
		Name:       secondProduct.Name,
		Category:   secondProduct.Category,
		Price:      secondProduct.Price,
		Stock:      5,
		Active:     true,
		SheetRow:   2,
	}})
	if err != nil {
		t.Fatalf("find sync conflicts: %v", err)
	}
	if len(conflicts) != 1 || conflicts[0].LocalStock != 6 || conflicts[0].SheetStock != 5 {
		t.Fatalf("expected adjusted sheet product conflict, got %#v", conflicts)
	}

	cartSale, err := service.CreateSale(ctx, organizationID.String(), userID, "Integration Admin", CreateSaleRequest{
		ClientRequestID: uuid.NewString(),
		BazarID:         bazarItem.ID.String(),
		Items: []CreateSaleItemRequest{
			{ProductID: product.ID.String(), Quantity: 2},
			{ProductID: secondProduct.ID.String(), Quantity: 1},
		},
		PaymentMethod: PaymentCash,
	})
	if err != nil {
		t.Fatalf("create cart sale: %v", err)
	}
	if cartSale.Sale.Total != 115 || len(cartSale.Sale.Items) != 2 {
		t.Fatalf("unexpected cart sale: %#v", cartSale.Sale)
	}
	conflicts, err = repository.FindSyncConflicts(ctx, organizationID.String(), []sheetProduct{{
		ExternalID: secondProduct.ExternalID,
		Name:       secondProduct.Name,
		Category:   secondProduct.Category,
		Price:      secondProduct.Price,
		Stock:      5,
		Active:     true,
		SheetRow:   2,
	}})
	if err != nil {
		t.Fatalf("find conflicts with pending sale: %v", err)
	}
	if len(conflicts) != 0 {
		t.Fatalf("pending sales must not appear as manual sync conflicts: %#v", conflicts)
	}

	report, err := service.Report(ctx, organizationID.String(), &bazarItem.ID, "")
	if err != nil {
		t.Fatalf("get report: %v", err)
	}
	if report.Total != 115 || report.ProductsSold != 3 || report.Operations != 1 || report.ExpectedCash != 215 {
		t.Fatalf("unexpected report totals: %#v", report)
	}
	if len(report.Products) != 2 || len(report.Sellers) != 1 || len(report.PaymentMethods) != 1 {
		t.Fatalf("unexpected report breakdown: %#v", report)
	}

	movements, err := repository.ListInventoryMovements(
		ctx,
		organizationID.String(),
		nil,
		&bazarItem.ID,
		50,
	)
	if err != nil {
		t.Fatalf("list inventory movements: %v", err)
	}
	if len(movements) < 4 {
		t.Fatalf("expected sale, cancellation and adjustment movements, got %d", len(movements))
	}

	closed, err := service.CloseBazar(
		ctx,
		organizationID.String(),
		bazarItem.ID,
		userID,
		"Integration Admin",
		CloseBazarRequest{ClosingCash: 210, Notes: "Corte de prueba"},
	)
	if err != nil {
		t.Fatalf("close bazar: %v", err)
	}
	if closed.Status != "closed" || closed.ExpectedCash == nil || *closed.ExpectedCash != 215 ||
		closed.CashDifference == nil || *closed.CashDifference != -5 {
		t.Fatalf("unexpected bazar close: %#v", closed)
	}
	finalReport, err := service.FinalBazarReport(ctx, organizationID.String(), bazarItem.ID)
	if err != nil {
		t.Fatalf("get final bazar report: %v", err)
	}
	if finalReport.Total != 115 || finalReport.ExpectedCash != 215 ||
		finalReport.ClosingCash == nil || *finalReport.ClosingCash != 210 {
		t.Fatalf("unexpected final report: %#v", finalReport)
	}

	_, err = service.CreateSale(ctx, organizationID.String(), userID, "Integration Admin", CreateSaleRequest{
		ClientRequestID: uuid.NewString(),
		BazarID:         bazarItem.ID.String(),
		ProductID:       secondProduct.ID.String(),
		Quantity:        1,
		PaymentMethod:   PaymentCash,
	})
	var closedBazarError *serviceError
	if !errors.As(err, &closedBazarError) || closedBazarError.Status != http.StatusConflict {
		t.Fatalf("expected closed bazar conflict, got %v", err)
	}

	audit, err := repository.ListAudit(ctx, organizationID.String(), &bazarItem.ID, 100)
	if err != nil {
		t.Fatalf("list audit: %v", err)
	}
	if len(audit) < 4 {
		t.Fatalf("expected bazar audit events, got %d", len(audit))
	}
}
