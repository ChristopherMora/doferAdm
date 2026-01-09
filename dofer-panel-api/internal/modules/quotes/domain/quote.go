package domain

import "time"

type Quote struct {
	ID                 string    `json:"id"`
	QuoteNumber        string    `json:"quote_number"`
	CustomerName       string    `json:"customer_name"`
	CustomerEmail      string    `json:"customer_email"`
	CustomerPhone      string    `json:"customer_phone"`
	Status             string    `json:"status"` // pending, approved, rejected, expired
	Subtotal           float64   `json:"subtotal"`
	Discount           float64   `json:"discount"`
	Tax                float64   `json:"tax"`
	Total              float64   `json:"total"`
	Notes              string    `json:"notes"`
	ValidUntil         time.Time `json:"valid_until"`
	CreatedBy          string    `json:"created_by"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
	ConvertedToOrderID string    `json:"converted_to_order_id,omitempty"`
}

type QuoteItem struct {
	ID              string    `json:"id"`
	QuoteID         string    `json:"quote_id"`
	ProductName     string    `json:"product_name"`
	Description     string    `json:"description"`
	WeightGrams     float64   `json:"weight_grams"`
	PrintTimeHours  float64   `json:"print_time_hours"`
	MaterialCost    float64   `json:"material_cost"`
	LaborCost       float64   `json:"labor_cost"`
	ElectricityCost float64   `json:"electricity_cost"`
	OtherCosts      float64   `json:"other_costs"`
	Subtotal        float64   `json:"subtotal"`
	Quantity        int       `json:"quantity"`
	UnitPrice       float64   `json:"unit_price"`
	Total           float64   `json:"total"`
	CreatedAt       time.Time `json:"created_at"`
}

type QuoteRepository interface {
	Create(quote *Quote) error
	FindByID(id string) (*Quote, error)
	FindAll(filters map[string]interface{}) ([]*Quote, error)
	Update(quote *Quote) error
	Delete(id string) error

	// Items
	AddItem(item *QuoteItem) error
	GetItems(quoteID string) ([]*QuoteItem, error)
	UpdateItem(item *QuoteItem) error
	DeleteItem(itemID string) error
}
