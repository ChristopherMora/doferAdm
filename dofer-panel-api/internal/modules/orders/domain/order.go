package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type OrderStatus string
type OrderPriority string
type OrderPlatform string

const (
	StatusNew       OrderStatus = "new"
	StatusPrinting  OrderStatus = "printing"
	StatusPost      OrderStatus = "post"
	StatusPacked    OrderStatus = "packed"
	StatusReady     OrderStatus = "ready"
	StatusDelivered OrderStatus = "delivered"
	StatusCancelled OrderStatus = "cancelled"
)

const (
	PriorityUrgent OrderPriority = "urgent"
	PriorityNormal OrderPriority = "normal"
	PriorityLow    OrderPriority = "low"
)

const (
	PlatformTikTok   OrderPlatform = "tiktok"
	PlatformShopify  OrderPlatform = "shopify"
	PlatformLocal    OrderPlatform = "local"
	PlatformOther    OrderPlatform = "other"
)

type Order struct {
	ID            string
	PublicID      string
	OrderNumber   string
	Platform      OrderPlatform
	Status        OrderStatus
	Priority      OrderPriority
	CustomerName  string
	CustomerEmail string
	CustomerPhone string
	ProductID     string
	ProductName   string
	Quantity      int
	Notes         string
	InternalNotes string
	Metadata      map[string]interface{}
	AssignedTo    string
	AssignedAt    *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
	CompletedAt   *time.Time
}

func NewOrder(
	orderNumber string,
	platform OrderPlatform,
	customerName string,
	productName string,
	quantity int,
) (*Order, error) {
	if orderNumber == "" {
		return nil, errors.New("order number is required")
	}
	if customerName == "" {
		return nil, errors.New("customer name is required")
	}
	if productName == "" {
		return nil, errors.New("product name is required")
	}
	if quantity <= 0 {
		return nil, errors.New("quantity must be greater than 0")
	}

	now := time.Now()
	return &Order{
		ID:           uuid.New().String(),
		PublicID:     uuid.New().String(),
		OrderNumber:  orderNumber,
		Platform:     platform,
		Status:       StatusNew,
		Priority:     PriorityNormal,
		CustomerName: customerName,
		ProductName:  productName,
		Quantity:     quantity,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

func (o *Order) ChangeStatus(newStatus OrderStatus) error {
	if !o.canTransitionTo(newStatus) {
		return errors.New("invalid status transition")
	}

	o.Status = newStatus
	o.UpdatedAt = time.Now()

	if newStatus == StatusDelivered {
		now := time.Now()
		o.CompletedAt = &now
	}

	return nil
}

func (o *Order) canTransitionTo(newStatus OrderStatus) bool {
	// Simplificado - puedes agregar lógica más compleja
	validTransitions := map[OrderStatus][]OrderStatus{
		StatusNew:       {StatusPrinting, StatusCancelled},
		StatusPrinting:  {StatusPost, StatusCancelled},
		StatusPost:      {StatusPacked, StatusCancelled},
		StatusPacked:    {StatusReady, StatusCancelled},
		StatusReady:     {StatusDelivered, StatusCancelled},
		StatusDelivered: {},
		StatusCancelled: {},
	}

	allowed, ok := validTransitions[o.Status]
	if !ok {
		return false
	}

	for _, status := range allowed {
		if status == newStatus {
			return true
		}
	}

	return false
}

func (o *Order) AssignTo(userID string) {
	o.AssignedTo = userID
	now := time.Now()
	o.AssignedAt = &now
	o.UpdatedAt = now
}
