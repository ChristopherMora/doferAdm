package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type UpdateOrderStatusCommand struct {
	OrderID   string
	NewStatus string
}

type UpdateOrderStatusHandler struct {
	repo domain.OrderRepository
}

func NewUpdateOrderStatusHandler(repo domain.OrderRepository) *UpdateOrderStatusHandler {
	return &UpdateOrderStatusHandler{repo: repo}
}

func (h *UpdateOrderStatusHandler) Handle(ctx context.Context, cmd UpdateOrderStatusCommand) (*domain.Order, error) {
	order, err := h.repo.FindByID(cmd.OrderID)
	if err != nil {
		return nil, ErrOrderNotFound
	}

	if err := order.ChangeStatus(domain.OrderStatus(cmd.NewStatus)); err != nil {
		return nil, err
	}

	if err := h.repo.Update(order); err != nil {
		return nil, err
	}

	return order, nil
}
