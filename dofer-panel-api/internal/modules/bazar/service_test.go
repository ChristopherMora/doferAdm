package bazar

import (
	"net/http"
	"strings"
	"testing"
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
	if command.ImageURL == nil || *command.ImageURL != "https://example.com/capybara.jpg" {
		t.Fatalf("unexpected image URL: %#v", command.ImageURL)
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
