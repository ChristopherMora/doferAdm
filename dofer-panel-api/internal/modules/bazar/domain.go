package bazar

import (
	"time"

	"github.com/google/uuid"
)

const (
	PaymentCash        = "cash"
	PaymentTransfer    = "transfer"
	PaymentCard        = "card"
	PaymentMercadoPago = "mercado_pago"
	PaymentOther       = "other"
)

type Product struct {
	ID            uuid.UUID  `json:"id"`
	ExternalID    string     `json:"external_id"`
	Name          string     `json:"name"`
	Category      string     `json:"category"`
	Price         float64    `json:"price"`
	Cost          *float64   `json:"cost,omitempty"`
	Stock         int        `json:"stock"`
	ImageURL      *string    `json:"image_url,omitempty"`
	Active        bool       `json:"active"`
	SheetRow      *int       `json:"sheet_row,omitempty"`
	SheetSyncedAt *time.Time `json:"sheet_synced_at,omitempty"`
}

type Bazar struct {
	ID                   uuid.UUID  `json:"id"`
	Name                 string     `json:"name"`
	Location             *string    `json:"location,omitempty"`
	Status               string     `json:"status"`
	DefaultPaymentMethod string     `json:"default_payment_method"`
	StartsAt             time.Time  `json:"starts_at"`
	EndsAt               *time.Time `json:"ends_at,omitempty"`
}

type SaleItem struct {
	ID                uuid.UUID `json:"id"`
	ProductID         uuid.UUID `json:"product_id"`
	ProductExternalID string    `json:"product_external_id"`
	ProductName       string    `json:"product_name"`
	Quantity          int       `json:"quantity"`
	UnitPrice         float64   `json:"unit_price"`
	Total             float64   `json:"total"`
	StockBefore       int       `json:"stock_before"`
	StockAfter        int       `json:"stock_after"`
}

type Sale struct {
	ID              uuid.UUID  `json:"id"`
	ExternalID      string     `json:"external_id"`
	ClientRequestID uuid.UUID  `json:"client_request_id"`
	BazarID         uuid.UUID  `json:"bazar_id"`
	BazarName       string     `json:"bazar_name"`
	SellerID        *uuid.UUID `json:"seller_id,omitempty"`
	SellerName      string     `json:"seller_name"`
	Subtotal        float64    `json:"subtotal"`
	Total           float64    `json:"total"`
	PaymentMethod   string     `json:"payment_method"`
	Status          string     `json:"status"`
	SyncStatus      string     `json:"sync_status"`
	SyncAttempts    int        `json:"sync_attempts"`
	LastSyncAt      *time.Time `json:"last_sync_at,omitempty"`
	SyncError       *string    `json:"sync_error,omitempty"`
	Notes           *string    `json:"notes,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	CancelledAt     *time.Time `json:"cancelled_at,omitempty"`
	Items           []SaleItem `json:"items"`
}

type DailyStats struct {
	Total            float64    `json:"total"`
	ProductsSold     int        `json:"products_sold"`
	Operations       int        `json:"operations"`
	AverageTicket    float64    `json:"average_ticket"`
	LastSaleAt       *time.Time `json:"last_sale_at,omitempty"`
	PendingSync      int        `json:"pending_sync"`
	LowStockProducts int        `json:"low_stock_products"`
	OutOfStock       int        `json:"out_of_stock_products"`
}

type SyncStatus struct {
	Configured       bool       `json:"configured"`
	Status           string     `json:"status"`
	PendingSales     int        `json:"pending_sales"`
	FailedSales      int        `json:"failed_sales"`
	LastProductSync  *time.Time `json:"last_product_sync,omitempty"`
	LastSaleSync     *time.Time `json:"last_sale_sync,omitempty"`
	LastError        string     `json:"last_error,omitempty"`
	ConfigurationMsg string     `json:"configuration_message,omitempty"`
}

type CreateBazarRequest struct {
	Name                 string  `json:"name"`
	Location             *string `json:"location,omitempty"`
	DefaultPaymentMethod string  `json:"default_payment_method,omitempty"`
}

type CreateSaleItemRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type CreateSaleRequest struct {
	ClientRequestID string                  `json:"client_request_id"`
	BazarID         string                  `json:"bazar_id"`
	ProductID       string                  `json:"product_id,omitempty"`
	Quantity        int                     `json:"quantity,omitempty"`
	Items           []CreateSaleItemRequest `json:"items,omitempty"`
	PaymentMethod   string                  `json:"payment_method"`
	Notes           *string                 `json:"notes,omitempty"`
}

type CreateSaleResult struct {
	Sale       *Sale `json:"sale"`
	Duplicated bool  `json:"duplicated"`
}

type SyncResult struct {
	ProductsImported int `json:"products_imported"`
	SalesSynced      int `json:"sales_synced"`
	SalesFailed      int `json:"sales_failed"`
}

type serviceError struct {
	Status  int
	Message string
}

func (e *serviceError) Error() string {
	return e.Message
}

type createSaleCommand struct {
	ClientRequestID uuid.UUID
	BazarID         uuid.UUID
	SellerID        uuid.UUID
	SellerName      string
	Items           []createSaleItemCommand
	PaymentMethod   string
	Notes           *string
}

type createSaleItemCommand struct {
	ProductID uuid.UUID
	Quantity  int
}

type sheetProduct struct {
	ExternalID string
	Name       string
	Category   string
	Price      float64
	Cost       *float64
	Stock      int
	ImageURL   *string
	Active     bool
	SheetRow   int
}
