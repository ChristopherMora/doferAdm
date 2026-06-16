package domain

import (
	"errors"
	"time"
)

type RequestStatus string

const (
	RequestPending  RequestStatus = "pending"
	RequestApproved RequestStatus = "approved"
	RequestRejected RequestStatus = "rejected"
)

type AffiliateOrderRequest struct {
	ID                     string        `json:"id"`
	OrganizationID         string        `json:"organization_id"`
	AffiliateID            string        `json:"affiliate_id"`
	ProductID              string        `json:"product_id,omitempty"`
	ProductName            string        `json:"product_name"`
	Quantity               int           `json:"quantity"`
	SuggestedPriceSnapshot float64       `json:"suggested_price_snapshot,omitempty"`
	MinPriceSnapshot       float64       `json:"min_price_snapshot,omitempty"`
	FinalPrice             float64       `json:"final_price"`
	Priority               string        `json:"priority"`
	ReferenceImages        []string      `json:"reference_images,omitempty"`
	CustomerName           string        `json:"customer_name"`
	CustomerEmail          string        `json:"customer_email,omitempty"`
	CustomerPhone          string        `json:"customer_phone,omitempty"`
	CustomerNotes          string        `json:"customer_notes,omitempty"`
	Status                 RequestStatus `json:"status"`
	RejectionReason        string        `json:"rejection_reason,omitempty"`
	ReviewedBy             string        `json:"reviewed_by,omitempty"`
	ReviewedAt             *time.Time    `json:"reviewed_at,omitempty"`
	OrderID                string        `json:"order_id,omitempty"`
	OrderStatus            string        `json:"order_status,omitempty"` // solo se llena al listar, via JOIN; no persiste en esta tabla
	CreatedAt              time.Time     `json:"created_at"`
	UpdatedAt              time.Time     `json:"updated_at"`
}

var (
	ErrRequestNotPending    = errors.New("affiliate order request is not pending review")
	ErrRejectionReasonEmpty = errors.New("rejection reason is required")
)

func NewAffiliateOrderRequest(affiliateID, productName, customerName string, quantity int, finalPrice float64) (*AffiliateOrderRequest, error) {
	if affiliateID == "" {
		return nil, errors.New("affiliate id is required")
	}
	if productName == "" {
		return nil, errors.New("product name is required")
	}
	if customerName == "" {
		return nil, errors.New("customer name is required")
	}
	if quantity <= 0 {
		return nil, errors.New("quantity must be greater than 0")
	}
	if finalPrice < 0 {
		return nil, errors.New("final price cannot be negative")
	}

	now := time.Now()
	return &AffiliateOrderRequest{
		AffiliateID:  affiliateID,
		ProductName:  productName,
		Quantity:     quantity,
		FinalPrice:   finalPrice,
		Priority:     "normal",
		CustomerName: customerName,
		Status:       RequestPending,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

func (req *AffiliateOrderRequest) Approve(reviewerID, orderID string) error {
	if req.Status != RequestPending {
		return ErrRequestNotPending
	}
	now := time.Now()
	req.Status = RequestApproved
	req.ReviewedBy = reviewerID
	req.ReviewedAt = &now
	req.OrderID = orderID
	req.UpdatedAt = now
	return nil
}

func (req *AffiliateOrderRequest) Reject(reviewerID, reason string) error {
	if req.Status != RequestPending {
		return ErrRequestNotPending
	}
	if reason == "" {
		return ErrRejectionReasonEmpty
	}
	now := time.Now()
	req.Status = RequestRejected
	req.ReviewedBy = reviewerID
	req.ReviewedAt = &now
	req.RejectionReason = reason
	req.UpdatedAt = now
	return nil
}
