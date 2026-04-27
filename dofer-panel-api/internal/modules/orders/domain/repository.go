package domain

type OrderRepository interface {
	Create(order *Order) error
	FindByID(id string, organizationID ...string) (*Order, error)
	FindByPublicID(publicID string) (*Order, error)
	FindAll(filters OrderFilters) ([]*Order, error)
	Update(order *Order) error

	// Order Items
	CreateOrderItem(item *OrderItem) error
	GetOrderItems(orderID, organizationID string) ([]*OrderItem, error)
	UpdateOrderItemStatus(orderID, itemID, organizationID string, isCompleted bool) error
	DeleteOrderItem(orderID, itemID, organizationID string) error

	// Order Payments
	AddPayment(payment *OrderPayment) error
	GetPayments(orderID, organizationID string) ([]*OrderPayment, error)
	GetPaymentByID(paymentID, organizationID string) (*OrderPayment, error)
	DeletePayment(paymentID, organizationID string) error
	UpdateOrderPaymentTotals(orderID, organizationID string, amountPaid float64, balance float64) error
}

type OrderFilters struct {
	OrganizationID string
	Status         OrderStatus
	Platform       OrderPlatform
	AssignedTo     string
	Limit          int
	Offset         int
}
