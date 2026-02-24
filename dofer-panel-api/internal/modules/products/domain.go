package products

import (
	"time"

	"github.com/google/uuid"
)

type Product struct {
	ID                        uuid.UUID `json:"id" db:"id"`
	SKU                       string    `json:"sku" db:"sku"`
	Name                      string    `json:"name" db:"name"`
	Description               *string   `json:"description,omitempty" db:"description"`
	STLFilePath               *string   `json:"stl_file_path,omitempty" db:"stl_file_path"`
	EstimatedPrintTimeMinutes *int      `json:"estimated_print_time_minutes,omitempty" db:"estimated_print_time_minutes"`
	Material                  *string   `json:"material,omitempty" db:"material"`
	Color                     *string   `json:"color,omitempty" db:"color"`
	IsActive                  bool      `json:"is_active" db:"is_active"`
	ImageURL                  *string   `json:"image_url,omitempty" db:"image_url"`
	CreatedAt                 time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at" db:"updated_at"`
}

type CreateProductRequest struct {
	SKU                       string  `json:"sku"`
	Name                      string  `json:"name"`
	Description               *string `json:"description,omitempty"`
	STLFilePath               *string `json:"stl_file_path,omitempty"`
	EstimatedPrintTimeMinutes *int    `json:"estimated_print_time_minutes,omitempty"`
	Material                  *string `json:"material,omitempty"`
	Color                     *string `json:"color,omitempty"`
	ImageURL                  *string `json:"image_url,omitempty"`
	IsActive                  *bool   `json:"is_active,omitempty"`
}

type UpdateProductRequest struct {
	SKU                       *string `json:"sku,omitempty"`
	Name                      *string `json:"name,omitempty"`
	Description               *string `json:"description,omitempty"`
	STLFilePath               *string `json:"stl_file_path,omitempty"`
	EstimatedPrintTimeMinutes *int    `json:"estimated_print_time_minutes,omitempty"`
	Material                  *string `json:"material,omitempty"`
	Color                     *string `json:"color,omitempty"`
	ImageURL                  *string `json:"image_url,omitempty"`
	IsActive                  *bool   `json:"is_active,omitempty"`
}

type UpdateProductActiveRequest struct {
	IsActive bool `json:"is_active"`
}
