package products

import (
	"time"

	"github.com/google/uuid"
)

type Product struct {
	ID                        uuid.UUID `json:"id" db:"id"`
	OrganizationID            uuid.UUID `json:"organization_id" db:"organization_id"`
	SKU                       string    `json:"sku" db:"sku"`
	Name                      string    `json:"name" db:"name"`
	Description               *string   `json:"description,omitempty" db:"description"`
	STLFilePath               *string   `json:"stl_file_path,omitempty" db:"stl_file_path"`
	EstimatedPrintTimeMinutes *int      `json:"estimated_print_time_minutes,omitempty" db:"estimated_print_time_minutes"`
	Material                  *string   `json:"material,omitempty" db:"material"`
	Color                     *string   `json:"color,omitempty" db:"color"`
	IsActive                  bool      `json:"is_active" db:"is_active"`
	ImageURL                  *string   `json:"image_url,omitempty" db:"image_url"`
	SuggestedPrice            *float64  `json:"suggested_price,omitempty" db:"suggested_price"`
	AffiliateVisible          bool      `json:"affiliate_visible" db:"affiliate_visible"`
	AffiliateMinPrice         *float64  `json:"affiliate_min_price,omitempty" db:"affiliate_min_price"`
	AffiliateCommissionType   *string   `json:"affiliate_commission_type,omitempty" db:"affiliate_commission_type"`
	AffiliateCommissionValue  *float64  `json:"affiliate_commission_value,omitempty" db:"affiliate_commission_value"`
	CreatedAt                 time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at" db:"updated_at"`
}

type CreateProductRequest struct {
	SKU                       string   `json:"sku"`
	Name                      string   `json:"name"`
	Description               *string  `json:"description,omitempty"`
	STLFilePath               *string  `json:"stl_file_path,omitempty"`
	EstimatedPrintTimeMinutes *int     `json:"estimated_print_time_minutes,omitempty"`
	Material                  *string  `json:"material,omitempty"`
	Color                     *string  `json:"color,omitempty"`
	ImageURL                  *string  `json:"image_url,omitempty"`
	IsActive                  *bool    `json:"is_active,omitempty"`
	SuggestedPrice            *float64 `json:"suggested_price,omitempty"`
	AffiliateVisible          *bool    `json:"affiliate_visible,omitempty"`
	AffiliateMinPrice         *float64 `json:"affiliate_min_price,omitempty"`
	AffiliateCommissionType   *string  `json:"affiliate_commission_type,omitempty"`
	AffiliateCommissionValue  *float64 `json:"affiliate_commission_value,omitempty"`
}

type UpdateProductRequest struct {
	SKU                       *string  `json:"sku,omitempty"`
	Name                      *string  `json:"name,omitempty"`
	Description               *string  `json:"description,omitempty"`
	STLFilePath               *string  `json:"stl_file_path,omitempty"`
	EstimatedPrintTimeMinutes *int     `json:"estimated_print_time_minutes,omitempty"`
	Material                  *string  `json:"material,omitempty"`
	Color                     *string  `json:"color,omitempty"`
	ImageURL                  *string  `json:"image_url,omitempty"`
	IsActive                  *bool    `json:"is_active,omitempty"`
	SuggestedPrice            *float64 `json:"suggested_price,omitempty"`
	AffiliateVisible          *bool    `json:"affiliate_visible,omitempty"`
	AffiliateMinPrice         *float64 `json:"affiliate_min_price,omitempty"`
	AffiliateCommissionType   *string  `json:"affiliate_commission_type,omitempty"`
	AffiliateCommissionValue  *float64 `json:"affiliate_commission_value,omitempty"`
}

type UpdateProductActiveRequest struct {
	IsActive bool `json:"is_active"`
}
