package customers

import (
	"time"

	"github.com/google/uuid"
)

type Customer struct {
	ID                    uuid.UUID  `json:"id" db:"id"`
	Name                  string     `json:"name" db:"name"`
	Email                 string     `json:"email" db:"email"`
	Phone                 *string    `json:"phone,omitempty" db:"phone"`
	Company               *string    `json:"company,omitempty" db:"company"`
	TaxID                 *string    `json:"tax_id,omitempty" db:"tax_id"`
	
	// Address
	AddressLine1          *string    `json:"address_line1,omitempty" db:"address_line1"`
	AddressLine2          *string    `json:"address_line2,omitempty" db:"address_line2"`
	City                  *string    `json:"city,omitempty" db:"city"`
	State                 *string    `json:"state,omitempty" db:"state"`
	PostalCode            *string    `json:"postal_code,omitempty" db:"postal_code"`
	Country               *string    `json:"country,omitempty" db:"country"`
	
	// Billing
	BillingName           *string    `json:"billing_name,omitempty" db:"billing_name"`
	BillingEmail          *string    `json:"billing_email,omitempty" db:"billing_email"`
	BillingAddress        *string    `json:"billing_address,omitempty" db:"billing_address"`
	
	// Statistics
	TotalOrders           int        `json:"total_orders" db:"total_orders"`
	TotalSpent            float64    `json:"total_spent" db:"total_spent"`
	AverageOrderValue     float64    `json:"average_order_value" db:"average_order_value"`
	LastOrderDate         *time.Time `json:"last_order_date,omitempty" db:"last_order_date"`
	
	// Segmentation
	CustomerTier          string     `json:"customer_tier" db:"customer_tier"`
	DiscountPercentage    float64    `json:"discount_percentage" db:"discount_percentage"`
	PreferredPaymentMethod *string   `json:"preferred_payment_method,omitempty" db:"preferred_payment_method"`
	PreferredMaterials    []string   `json:"preferred_materials" db:"preferred_materials"`
	
	// Internal notes
	InternalNotes         *string    `json:"internal_notes,omitempty" db:"internal_notes"`
	Tags                  []string   `json:"tags" db:"tags"`
	
	// Marketing
	AcceptsMarketing      bool       `json:"accepts_marketing" db:"accepts_marketing"`
	MarketingSegment      *string    `json:"marketing_segment,omitempty" db:"marketing_segment"`
	AcquisitionSource     *string    `json:"acquisition_source,omitempty" db:"acquisition_source"`
	
	// Metadata
	Status                string     `json:"status" db:"status"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at" db:"updated_at"`
	CreatedBy             *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
}

type CustomerInteraction struct {
	ID              uuid.UUID  `json:"id" db:"id"`
	CustomerID      uuid.UUID  `json:"customer_id" db:"customer_id"`
	InteractionType string     `json:"interaction_type" db:"interaction_type"`
	Subject         *string    `json:"subject,omitempty" db:"subject"`
	Description     *string    `json:"description,omitempty" db:"description"`
	Priority        string     `json:"priority" db:"priority"`
	Status          string     `json:"status" db:"status"`
	AssignedTo      *uuid.UUID `json:"assigned_to,omitempty" db:"assigned_to"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
	CreatedBy       *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
}

type CustomerAnalytics struct {
	ID                    uuid.UUID  `json:"id" db:"id"`
	Name                  string     `json:"name" db:"name"`
	Email                 string     `json:"email" db:"email"`
	CustomerTier          string     `json:"customer_tier" db:"customer_tier"`
	TotalOrders           int        `json:"total_orders" db:"total_orders"`
	TotalSpent            float64    `json:"total_spent" db:"total_spent"`
	AverageOrderValue     float64    `json:"average_order_value" db:"average_order_value"`
	DiscountPercentage    float64    `json:"discount_percentage" db:"discount_percentage"`
	LastOrderDate         *time.Time `json:"last_order_date,omitempty" db:"last_order_date"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	Status                string     `json:"status" db:"status"`
	OrdersLast30Days      int        `json:"orders_last_30_days" db:"orders_last_30_days"`
	RevenueLast30Days     float64    `json:"revenue_last_30_days" db:"revenue_last_30_days"`
	InteractionsLast30Days int       `json:"interactions_last_30_days" db:"interactions_last_30_days"`
	EngagementStatus      string     `json:"engagement_status" db:"engagement_status"`
}

type CreateCustomerRequest struct {
	Name                  string   `json:"name" binding:"required"`
	Email                 string   `json:"email" binding:"required,email"`
	Phone                 *string  `json:"phone,omitempty"`
	Company               *string  `json:"company,omitempty"`
	TaxID                 *string  `json:"tax_id,omitempty"`
	AddressLine1          *string  `json:"address_line1,omitempty"`
	AddressLine2          *string  `json:"address_line2,omitempty"`
	City                  *string  `json:"city,omitempty"`
	State                 *string  `json:"state,omitempty"`
	PostalCode            *string  `json:"postal_code,omitempty"`
	Country               *string  `json:"country,omitempty"`
	BillingName           *string  `json:"billing_name,omitempty"`
	BillingEmail          *string  `json:"billing_email,omitempty"`
	BillingAddress        *string  `json:"billing_address,omitempty"`
	PreferredPaymentMethod *string `json:"preferred_payment_method,omitempty"`
	PreferredMaterials    []string `json:"preferred_materials,omitempty"`
	InternalNotes         *string  `json:"internal_notes,omitempty"`
	Tags                  []string `json:"tags,omitempty"`
	AcceptsMarketing      bool     `json:"accepts_marketing"`
	AcquisitionSource     *string  `json:"acquisition_source,omitempty"`
}

type UpdateCustomerRequest struct {
	Name                  *string  `json:"name,omitempty"`
	Email                 *string  `json:"email,omitempty"`
	Phone                 *string  `json:"phone,omitempty"`
	Company               *string  `json:"company,omitempty"`
	TaxID                 *string  `json:"tax_id,omitempty"`
	AddressLine1          *string  `json:"address_line1,omitempty"`
	AddressLine2          *string  `json:"address_line2,omitempty"`
	City                  *string  `json:"city,omitempty"`
	State                 *string  `json:"state,omitempty"`
	PostalCode            *string  `json:"postal_code,omitempty"`
	Country               *string  `json:"country,omitempty"`
	BillingName           *string  `json:"billing_name,omitempty"`
	BillingEmail          *string  `json:"billing_email,omitempty"`
	BillingAddress        *string  `json:"billing_address,omitempty"`
	DiscountPercentage    *float64 `json:"discount_percentage,omitempty"`
	PreferredPaymentMethod *string `json:"preferred_payment_method,omitempty"`
	PreferredMaterials    []string `json:"preferred_materials,omitempty"`
	InternalNotes         *string  `json:"internal_notes,omitempty"`
	Tags                  []string `json:"tags,omitempty"`
	AcceptsMarketing      *bool    `json:"accepts_marketing,omitempty"`
	Status                *string  `json:"status,omitempty"`
}

type CreateInteractionRequest struct {
	InteractionType string     `json:"interaction_type" binding:"required"`
	Subject         *string    `json:"subject,omitempty"`
	Description     *string    `json:"description,omitempty"`
	Priority        string     `json:"priority"`
	AssignedTo      *uuid.UUID `json:"assigned_to,omitempty"`
}
