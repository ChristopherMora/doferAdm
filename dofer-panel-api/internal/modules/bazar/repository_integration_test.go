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
	})
	if err != nil {
		t.Fatalf("create bazar: %v", err)
	}
	product, err := service.CreateProduct(ctx, organizationID.String(), CreateProductRequest{
		SKU:      "TEST-CAP-01",
		Name:     "Capibara café",
		Category: "Doflins",
		Price:    40,
		Stock:    12,
	})
	if err != nil {
		t.Fatalf("create product: %v", err)
	}

	_, err = service.CreateProduct(ctx, organizationID.String(), CreateProductRequest{
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

	cancelled, err := service.CancelSale(ctx, organizationID.String(), result.Sale.ID, userID, true)
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
}
