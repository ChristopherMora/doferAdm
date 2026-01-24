package domain

import (
	"time"
)

type OrderPayment struct {
	ID            string    `json:"id"`
	OrderID       string    `json:"order_id"`
	Amount        float64   `json:"amount"`
	PaymentMethod string    `json:"payment_method"`
	PaymentDate   time.Time `json:"payment_date"`
	Notes         string    `json:"notes"`
	CreatedBy     string    `json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
}
