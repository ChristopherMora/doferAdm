package domain

type OrderRepository interface {
	Create(order *Order) error
	FindByID(id string) (*Order, error)
	FindByPublicID(publicID string) (*Order, error)
	FindAll(filters OrderFilters) ([]*Order, error)
	Update(order *Order) error
	
	// Order Items
	CreateOrderItem(item *OrderItem) error
	GetOrderItems(orderID string) ([]*OrderItem, error)
	UpdateOrderItemStatus(itemID string, isCompleted bool) error
	DeleteOrderItem(itemID string) error
	
	// Order Payments
	AddPayment(payment *OrderPayment) error
	GetPayments(orderID string) ([]*OrderPayment, error)
	UpdateOrderPaymentTotals(orderID string, amountPaid float64, balance float64) error
}

type OrderFilters struct {
	Status     OrderStatus
	Platform   OrderPlatform
	AssignedTo string
	Limit      int
	Offset     int
}
