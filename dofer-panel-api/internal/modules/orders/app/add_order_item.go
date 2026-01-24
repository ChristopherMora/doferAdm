package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/google/uuid"
)

type AddOrderItemCommand struct {
	OrderID     string
	ProductName string
	Description string
	Quantity    int
	UnitPrice   float64
}

type AddOrderItemHandler struct {
	repo domain.OrderRepository
}

func NewAddOrderItemHandler(repo domain.OrderRepository) *AddOrderItemHandler {
	return &AddOrderItemHandler{repo: repo}
}

func (h *AddOrderItemHandler) Handle(ctx context.Context, cmd AddOrderItemCommand) (*domain.OrderItem, error) {
	// Verificar que la orden existe
	_, err := h.repo.FindByID(cmd.OrderID)
	if err != nil {
		return nil, err
	}

	total := float64(cmd.Quantity) * cmd.UnitPrice

	item := &domain.OrderItem{
		ID:          uuid.New().String(),
		OrderID:     cmd.OrderID,
		ProductName: cmd.ProductName,
		Description: cmd.Description,
		Quantity:    cmd.Quantity,
		UnitPrice:   cmd.UnitPrice,
		Total:       total,
		IsCompleted: false,
	}

	if err := h.repo.CreateOrderItem(item); err != nil {
		return nil, err
	}

	return item, nil
}
