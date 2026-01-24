package domain

import (
	"time"
)

type OrderPayment struct {
	ID            string
	OrderID       string
	Amount        float64
	PaymentMethod string
	PaymentDate   time.Time
	Notes         string
	CreatedBy     string
	CreatedAt     time.Time
}
