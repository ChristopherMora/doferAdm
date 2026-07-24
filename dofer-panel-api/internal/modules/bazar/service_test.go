package bazar

import (
	"encoding/base64"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestPrepareCreateProduct(t *testing.T) {
	imageURL := " https://example.com/capybara.jpg "
	command, err := prepareCreateProduct(CreateProductRequest{
		SKU:      " CAP-01 ",
		Name:     " Capibara café ",
		Category: " Doflins ",
		Price:    40,
		Stock:    12,
		ImageURL: &imageURL,
	})
	if err != nil {
		t.Fatalf("prepareCreateProduct returned an error: %v", err)
	}

	if command.SKU != "CAP-01" || command.Name != "Capibara café" {
		t.Fatalf("unexpected normalized identity: %#v", command)
	}
	if command.Category != "Doflins" || command.Price != 40 || command.Stock != 12 {
		t.Fatalf("unexpected product values: %#v", command)
	}
	if !command.TrackStock {
		t.Fatal("expected regular products to track stock by default")
	}
	if command.ImageURL == nil || *command.ImageURL != "https://example.com/capybara.jpg" {
		t.Fatalf("unexpected image URL: %#v", command.ImageURL)
	}
}

func TestPrepareCreateProductAllowsFreeSaleProducts(t *testing.T) {
	trackStock := false
	command, err := prepareCreateProduct(CreateProductRequest{
		Name:       "Producto rápido",
		Price:      25,
		TrackStock: &trackStock,
	})
	if err != nil {
		t.Fatalf("prepareCreateProduct returned an error: %v", err)
	}
	if command.TrackStock {
		t.Fatal("expected quick product to allow sales without stock tracking")
	}
}

func TestPrepareCreateProductPreservesOfflineID(t *testing.T) {
	productID := uuid.New()
	command, err := prepareCreateProduct(CreateProductRequest{
		ID:    productID.String(),
		Name:  "Producto creado sin conexión",
		Price: 25,
	})
	if err != nil {
		t.Fatalf("prepareCreateProduct returned an error: %v", err)
	}
	if command.ID != productID {
		t.Fatalf("expected product ID %s, got %s", productID, command.ID)
	}
}

func TestValidateProductImageDataURL(t *testing.T) {
	image := "data:image/webp;base64," + base64.StdEncoding.EncodeToString([]byte("webp image"))
	validated, err := validateProductImage(&image)
	if err != nil {
		t.Fatalf("validateProductImage returned an error: %v", err)
	}
	if validated == nil || *validated != image {
		t.Fatalf("unexpected validated image: %#v", validated)
	}

	tooLarge := "data:image/png;base64," + base64.StdEncoding.EncodeToString(make([]byte, 700_001))
	_, err = validateProductImage(&tooLarge)
	if err == nil {
		t.Fatal("expected oversized image validation error")
	}
}

func TestPrepareStockAdjustmentDirections(t *testing.T) {
	tests := []struct {
		movementType string
		quantity     int
		wantDelta    int
	}{
		{movementType: "inventory_entry", quantity: -3, wantDelta: 3},
		{movementType: "return", quantity: 2, wantDelta: 2},
		{movementType: "damaged", quantity: 2, wantDelta: -2},
		{movementType: "lost", quantity: 2, wantDelta: -2},
		{movementType: "gift", quantity: 2, wantDelta: -2},
		{movementType: "sample", quantity: 2, wantDelta: -2},
		{movementType: "manual_adjustment", quantity: -2, wantDelta: -2},
	}

	for _, test := range tests {
		t.Run(test.movementType, func(t *testing.T) {
			command, err := prepareStockAdjustment(
				uuid.New(),
				uuid.New(),
				"Admin",
				AdjustStockRequest{
					MovementType: test.movementType,
					Quantity:     test.quantity,
				},
			)
			if err != nil {
				t.Fatalf("prepareStockAdjustment returned an error: %v", err)
			}
			if command.Delta != test.wantDelta {
				t.Fatalf("expected delta %d, got %d", test.wantDelta, command.Delta)
			}
		})
	}
}

func TestPrepareCreateProductGeneratesSKU(t *testing.T) {
	command, err := prepareCreateProduct(CreateProductRequest{Name: "Producto manual"})
	if err != nil {
		t.Fatalf("prepareCreateProduct returned an error: %v", err)
	}
	if !strings.HasPrefix(command.SKU, "MAN-") || len(command.SKU) != 12 {
		t.Fatalf("unexpected generated SKU: %q", command.SKU)
	}
}

func TestPrepareCreateProductValidation(t *testing.T) {
	invalidURL := "ftp://example.com/product.jpg"
	tests := []struct {
		name    string
		request CreateProductRequest
	}{
		{name: "missing name", request: CreateProductRequest{}},
		{name: "negative price", request: CreateProductRequest{Name: "Producto", Price: -1}},
		{name: "negative stock", request: CreateProductRequest{Name: "Producto", Stock: -1}},
		{name: "invalid image URL", request: CreateProductRequest{Name: "Producto", ImageURL: &invalidURL}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := prepareCreateProduct(test.request)
			if err == nil {
				t.Fatal("expected validation error")
			}
			serviceErr, ok := err.(*serviceError)
			if !ok || serviceErr.Status != http.StatusBadRequest {
				t.Fatalf("unexpected error: %#v", err)
			}
		})
	}
}
