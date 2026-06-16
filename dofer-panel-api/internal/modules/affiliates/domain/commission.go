package domain

import "time"

type CommissionStatus string

const (
	CommissionPending CommissionStatus = "pending"
	CommissionPaid    CommissionStatus = "paid"
)

type AffiliateCommission struct {
	ID                      string           `json:"id"`
	OrganizationID          string           `json:"organization_id"`
	AffiliateID             string           `json:"affiliate_id"`
	AffiliateOrderRequestID string           `json:"affiliate_order_request_id"`
	OrderID                 string           `json:"order_id"`
	CommissionAmount        float64          `json:"commission_amount"`
	Status                  CommissionStatus `json:"status"`
	PaidAt                  *time.Time       `json:"paid_at,omitempty"`
	PaidBy                  string           `json:"paid_by,omitempty"`
	PaidBatchID             string           `json:"paid_batch_id,omitempty"`
	PaymentMethod           string           `json:"payment_method,omitempty"`
	PaymentReference        string           `json:"payment_reference,omitempty"`
	PaymentNotes            string           `json:"payment_notes,omitempty"`
	CreatedAt               time.Time        `json:"created_at"`
	UpdatedAt               time.Time        `json:"updated_at"`
}

func NewAffiliateCommission(affiliateID, requestID, orderID string, amount float64) *AffiliateCommission {
	now := time.Now()
	return &AffiliateCommission{
		AffiliateID:             affiliateID,
		AffiliateOrderRequestID: requestID,
		OrderID:                 orderID,
		CommissionAmount:        amount,
		Status:                  CommissionPending,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
}
