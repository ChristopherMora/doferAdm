package bazar

import (
	"strings"
	"testing"
)

func TestParseInventoryRows(t *testing.T) {
	rows := [][]any{
		{"ID", "Producto", "Categoría", "Precio", "Costo", "Stock", "Imagen", "Activo"},
		{"DOF-001", "Capibara café", "Doflins", 40.0, 18.0, 12.0, "https://example.com/1.jpg", "Sí"},
		{"DOF-002", "Ajolote", "Flexis", "55", "", "0", "", "No"},
	}

	products, err := parseInventoryRows(rows)
	if err != nil {
		t.Fatalf("parseInventoryRows returned an error: %v", err)
	}
	if len(products) != 2 {
		t.Fatalf("expected 2 products, got %d", len(products))
	}

	first := products[0]
	if first.ExternalID != "DOF-001" || first.Name != "Capibara café" {
		t.Fatalf("unexpected first product: %#v", first)
	}
	if first.Category != "Doflins" || first.Price != 40 || first.Stock != 12 {
		t.Fatalf("unexpected inventory values: %#v", first)
	}
	if first.Cost == nil || *first.Cost != 18 {
		t.Fatalf("expected cost 18, got %#v", first.Cost)
	}
	if first.ImageURL == nil || *first.ImageURL != "https://example.com/1.jpg" {
		t.Fatalf("unexpected image URL: %#v", first.ImageURL)
	}
	if !first.Active || first.SheetRow != 2 {
		t.Fatalf("unexpected active/row values: %#v", first)
	}

	second := products[1]
	if second.Active {
		t.Fatal("expected second product to be inactive")
	}
	if second.Cost != nil || second.ImageURL != nil {
		t.Fatalf("expected optional fields to be nil: %#v", second)
	}
}

func TestParseInventoryRowsRequiresCoreColumns(t *testing.T) {
	_, err := parseInventoryRows([][]any{
		{"Producto", "Precio", "Stock"},
		{"Capibara", 40, 3},
	})
	if err == nil || !strings.Contains(err.Error(), "columna ID") {
		t.Fatalf("expected missing ID error, got %v", err)
	}
}

func TestColumnName(t *testing.T) {
	tests := map[int]string{
		0:  "A",
		25: "Z",
		26: "AA",
		27: "AB",
		51: "AZ",
		52: "BA",
	}
	for input, expected := range tests {
		if actual := columnName(input); actual != expected {
			t.Errorf("columnName(%d) = %q, expected %q", input, actual, expected)
		}
	}
}

func TestNormalizePaymentMethod(t *testing.T) {
	if actual := normalizePaymentMethod(""); actual != PaymentCash {
		t.Fatalf("empty payment method = %q, expected cash", actual)
	}
	if actual := normalizePaymentMethod(" mercado_pago "); actual != PaymentMercadoPago {
		t.Fatalf("unexpected normalized method: %q", actual)
	}
	if actual := normalizePaymentMethod("bitcoin"); actual != "" {
		t.Fatalf("invalid payment method should be empty, got %q", actual)
	}
}
