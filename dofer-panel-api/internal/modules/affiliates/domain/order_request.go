package domain

import (
	"errors"
	"time"
)

type RequestStatus string

const (
	RequestPending      RequestStatus = "pending"
	RequestNeedsChanges RequestStatus = "needs_changes"
	RequestApproved     RequestStatus = "approved"
	RequestRejected     RequestStatus = "rejected"
	RequestCancelled    RequestStatus = "cancelled"
)

type AffiliateOrderRequest struct {
	ID                       string          `json:"id"`
	OrganizationID           string          `json:"organization_id"`
	AffiliateID              string          `json:"affiliate_id"`
	ProductID                string          `json:"product_id,omitempty"`
	ProductName              string          `json:"product_name"`
	Quantity                 int             `json:"quantity"`
	SuggestedPriceSnapshot   float64         `json:"suggested_price_snapshot,omitempty"`
	MinPriceSnapshot         float64         `json:"min_price_snapshot,omitempty"`
	FinalPrice               float64         `json:"final_price"`
	CustomerAmountPaid       float64         `json:"customer_amount_paid"`
	CustomerPaymentStatus    string          `json:"customer_payment_status"`
	CustomerPaymentMethod    string          `json:"customer_payment_method,omitempty"`
	CustomerPaymentReference string          `json:"customer_payment_reference,omitempty"`
	CustomerPaymentNotes     string          `json:"customer_payment_notes,omitempty"`
	Priority                 string          `json:"priority"`
	ReferenceImages          []string        `json:"reference_images,omitempty"`
	CustomerName             string          `json:"customer_name"`
	CustomerEmail            string          `json:"customer_email,omitempty"`
	CustomerPhone            string          `json:"customer_phone,omitempty"`
	CustomerNotes            string          `json:"customer_notes,omitempty"`
	Status                   RequestStatus   `json:"status"`
	RequestedChanges         string          `json:"requested_changes,omitempty"`
	RejectionReason          string          `json:"rejection_reason,omitempty"`
	ReviewedBy               string          `json:"reviewed_by,omitempty"`
	ReviewedAt               *time.Time      `json:"reviewed_at,omitempty"`
	CancelledReason          string          `json:"cancelled_reason,omitempty"`
	CancelledBy              string          `json:"cancelled_by,omitempty"`
	CancelledAt              *time.Time      `json:"cancelled_at,omitempty"`
	PromisedDeliveryDate     *time.Time      `json:"promised_delivery_date,omitempty"`
	DeliveryMethod           string          `json:"delivery_method"`
	DeliveryStatus           string          `json:"delivery_status"`
	DeliveryAddress          string          `json:"delivery_address,omitempty"`
	DeliveryTrackingNumber   string          `json:"delivery_tracking_number,omitempty"`
	DeliveryNotes            string          `json:"delivery_notes,omitempty"`
	ProductionChecklist      map[string]bool `json:"production_checklist,omitempty"`
	InternalOwnerID          string          `json:"internal_owner_id,omitempty"`
	DuplicatedFromRequestID  string          `json:"duplicated_from_request_id,omitempty"`
	OrderID                  string          `json:"order_id,omitempty"`
	OrderStatus              string          `json:"order_status,omitempty"` // solo se llena al listar, via JOIN; no persiste en esta tabla
	CommissionTypeSnapshot   string          `json:"commission_type_snapshot,omitempty"`
	CommissionValueSnapshot  float64         `json:"commission_value_snapshot"`
	CreatedAt                time.Time       `json:"created_at"`
	UpdatedAt                time.Time       `json:"updated_at"`
}

var (
	ErrRequestNotPending    = errors.New("affiliate order request is not pending review")
	ErrRejectionReasonEmpty = errors.New("rejection reason is required")
	ErrRequestFinalized     = errors.New("affiliate order request is already finalized")
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
		AffiliateID:           affiliateID,
		ProductName:           productName,
		Quantity:              quantity,
		FinalPrice:            finalPrice,
		CustomerPaymentStatus: "unpaid",
		Priority:              "normal",
		CustomerName:          customerName,
		Status:                RequestPending,
		DeliveryMethod:        "pickup",
		DeliveryStatus:        "pending",
		ProductionChecklist:   map[string]bool{},
		CreatedAt:             now,
		UpdatedAt:             now,
	}, nil
}

func (req *AffiliateOrderRequest) Approve(reviewerID, orderID string) error {
	if req.Status != RequestPending && req.Status != RequestNeedsChanges {
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
	if req.Status != RequestPending && req.Status != RequestNeedsChanges {
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

func (req *AffiliateOrderRequest) RequestChanges(reviewerID, reason string) error {
	if req.Status != RequestPending {
		return ErrRequestNotPending
	}
	if reason == "" {
		return ErrRejectionReasonEmpty
	}
	now := time.Now()
	req.Status = RequestNeedsChanges
	req.ReviewedBy = reviewerID
	req.ReviewedAt = &now
	req.RequestedChanges = reason
	req.UpdatedAt = now
	return nil
}

func (req *AffiliateOrderRequest) Cancel(actorID, reason string) error {
	if req.Status == RequestApproved || req.Status == RequestRejected || req.Status == RequestCancelled {
		return ErrRequestFinalized
	}
	now := time.Now()
	req.Status = RequestCancelled
	req.CancelledBy = actorID
	req.CancelledAt = &now
	req.CancelledReason = reason
	req.UpdatedAt = now
	return nil
}
