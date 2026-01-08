package domain

type OrderRepository interface {
	Create(order *Order) error
	FindByID(id string) (*Order, error)
	FindByPublicID(publicID string) (*Order, error)
	FindAll(filters OrderFilters) ([]*Order, error)
	Update(order *Order) error
}

type OrderFilters struct {
	Status     OrderStatus
	Platform   OrderPlatform
	AssignedTo string
	Limit      int
	Offset     int
}
