package bazar

import (
	"encoding/json"
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
	TrackStock    bool       `json:"track_stock"`
	ImageURL      *string    `json:"image_url,omitempty"`
	Active        bool       `json:"active"`
	SheetRow      *int       `json:"sheet_row,omitempty"`
	SheetSyncedAt *time.Time `json:"sheet_synced_at,omitempty"`
	Source        string     `json:"source"`
	SyncPolicy    string     `json:"stock_sync_policy"`
}

type Bazar struct {
	ID                   uuid.UUID  `json:"id"`
	Name                 string     `json:"name"`
	Location             *string    `json:"location,omitempty"`
	Status               string     `json:"status"`
	DefaultPaymentMethod string     `json:"default_payment_method"`
	StartsAt             time.Time  `json:"starts_at"`
	EndsAt               *time.Time `json:"ends_at,omitempty"`
	OpeningCash          float64    `json:"opening_cash"`
	ExpectedCash         *float64   `json:"expected_cash,omitempty"`
	ClosingCash          *float64   `json:"closing_cash,omitempty"`
	CashDifference       *float64   `json:"cash_difference,omitempty"`
	ClosingNotes         *string    `json:"closing_notes,omitempty"`
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
	CashReceived    *float64   `json:"cash_received,omitempty"`
	ChangeDue       *float64   `json:"change_due,omitempty"`
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
	OpeningCash          float64 `json:"opening_cash,omitempty"`
}

type CreateProductRequest struct {
	ID         string   `json:"id,omitempty"`
	SKU        string   `json:"sku,omitempty"`
	Name       string   `json:"name"`
	Category   string   `json:"category,omitempty"`
	Price      float64  `json:"price"`
	Cost       *float64 `json:"cost,omitempty"`
	Stock      int      `json:"stock"`
	TrackStock *bool    `json:"track_stock,omitempty"`
	ImageURL   *string  `json:"image_url,omitempty"`
}

type UpdateProductRequest struct {
	SKU        *string  `json:"sku,omitempty"`
	Name       *string  `json:"name,omitempty"`
	Category   *string  `json:"category,omitempty"`
	Price      *float64 `json:"price,omitempty"`
	Cost       *float64 `json:"cost,omitempty"`
	ImageURL   *string  `json:"image_url,omitempty"`
	Active     *bool    `json:"active,omitempty"`
	SyncPolicy *string  `json:"stock_sync_policy,omitempty"`
}

type AdjustStockRequest struct {
	BazarID      string `json:"bazar_id,omitempty"`
	MovementType string `json:"movement_type"`
	Quantity     int    `json:"quantity"`
	Reason       string `json:"reason,omitempty"`
}

type InventoryMovement struct {
	ID           uuid.UUID  `json:"id"`
	ProductID    uuid.UUID  `json:"product_id"`
	ProductName  string     `json:"product_name"`
	BazarID      *uuid.UUID `json:"bazar_id,omitempty"`
	BazarName    *string    `json:"bazar_name,omitempty"`
	MovementType string     `json:"movement_type"`
	Quantity     int        `json:"quantity"`
	StockBefore  int        `json:"stock_before"`
	StockAfter   int        `json:"stock_after"`
	Reason       *string    `json:"reason,omitempty"`
	ActorName    string     `json:"actor_name"`
	CreatedAt    time.Time  `json:"created_at"`
}

type CloseBazarRequest struct {
	ClosingCash float64 `json:"closing_cash"`
	Notes       string  `json:"notes,omitempty"`
}

type PaymentSummary struct {
	Method     string  `json:"method"`
	Operations int     `json:"operations"`
	Total      float64 `json:"total"`
}

type ProductSummary struct {
	ProductID   uuid.UUID `json:"product_id"`
	ExternalID  string    `json:"external_id"`
	ProductName string    `json:"product_name"`
	Quantity    int       `json:"quantity"`
	Total       float64   `json:"total"`
}

type SellerSummary struct {
	SellerName string  `json:"seller_name"`
	Operations int     `json:"operations"`
	Quantity   int     `json:"quantity"`
	Total      float64 `json:"total"`
}

type BazarReport struct {
	Bazar          *Bazar           `json:"bazar,omitempty"`
	Date           string           `json:"date"`
	From           time.Time        `json:"from"`
	To             time.Time        `json:"to"`
	Total          float64          `json:"total"`
	ProductsSold   int              `json:"products_sold"`
	Operations     int              `json:"operations"`
	AverageTicket  float64          `json:"average_ticket"`
	CancelledSales int              `json:"cancelled_sales"`
	PaymentMethods []PaymentSummary `json:"payment_methods"`
	Products       []ProductSummary `json:"products"`
	Sellers        []SellerSummary  `json:"sellers"`
	ExpectedCash   float64          `json:"expected_cash"`
	ClosingCash    *float64         `json:"closing_cash,omitempty"`
	CashDifference *float64         `json:"cash_difference,omitempty"`
}

type AuditLog struct {
	ID         uuid.UUID       `json:"id"`
	BazarID    *uuid.UUID      `json:"bazar_id,omitempty"`
	ActorID    *uuid.UUID      `json:"actor_id,omitempty"`
	ActorName  string          `json:"actor_name"`
	Action     string          `json:"action"`
	EntityType string          `json:"entity_type"`
	EntityID   *uuid.UUID      `json:"entity_id,omitempty"`
	Details    json.RawMessage `json:"details"`
	CreatedAt  time.Time       `json:"created_at"`
}

type SyncConflict struct {
	ProductID   uuid.UUID `json:"product_id"`
	ExternalID  string    `json:"external_id"`
	ProductName string    `json:"product_name"`
	LocalStock  int       `json:"local_stock"`
	SheetStock  int       `json:"sheet_stock"`
	LocalPrice  float64   `json:"local_price"`
	SheetPrice  float64   `json:"sheet_price"`
}

type SyncRequest struct {
	ConflictStrategy string `json:"conflict_strategy,omitempty"`
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
	CashReceived    *float64                `json:"cash_received,omitempty"`
	Notes           *string                 `json:"notes,omitempty"`
}

type DailyCut struct {
	ID             uuid.UUID `json:"id"`
	BazarID        uuid.UUID `json:"bazar_id"`
	BazarName      string    `json:"bazar_name"`
	BusinessDate   string    `json:"business_date"`
	OpeningCash    float64   `json:"opening_cash"`
	CashSales      float64   `json:"cash_sales"`
	ExpectedCash   float64   `json:"expected_cash"`
	ClosingCash    float64   `json:"closing_cash"`
	CashDifference float64   `json:"cash_difference"`
	Notes          *string   `json:"notes,omitempty"`
	ClosedByName   string    `json:"closed_by_name"`
	ClosedAt       time.Time `json:"closed_at"`
}

type CreateDailyCutRequest struct {
	Date        string  `json:"date,omitempty"`
	OpeningCash float64 `json:"opening_cash"`
	ClosingCash float64 `json:"closing_cash"`
	Notes       string  `json:"notes,omitempty"`
}

type CreateSaleResult struct {
	Sale       *Sale `json:"sale"`
	Duplicated bool  `json:"duplicated"`
}

type SyncResult struct {
	ProductsImported  int `json:"products_imported"`
	SalesSynced       int `json:"sales_synced"`
	SalesFailed       int `json:"sales_failed"`
	ConflictsResolved int `json:"conflicts_resolved"`
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
	CashReceived    *float64
	Notes           *string
}

type createSaleItemCommand struct {
	ProductID uuid.UUID
	Quantity  int
}

type createProductCommand struct {
	ID         uuid.UUID
	SKU        string
	Name       string
	Category   string
	Price      float64
	Cost       *float64
	Stock      int
	TrackStock bool
	ImageURL   *string
}

type updateProductCommand struct {
	SKU        string
	Name       string
	Category   string
	Price      float64
	Cost       *float64
	ImageURL   *string
	Active     bool
	SyncPolicy string
}

type adjustStockCommand struct {
	BazarID      *uuid.UUID
	ProductID    uuid.UUID
	MovementType string
	Delta        int
	Reason       *string
	ActorID      uuid.UUID
	ActorName    string
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
