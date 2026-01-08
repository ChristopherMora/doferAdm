package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type AssignOrderCommand struct {
	OrderID string
	UserID  string
}

type AssignOrderHandler struct {
	repo domain.OrderRepository
}

func NewAssignOrderHandler(repo domain.OrderRepository) *AssignOrderHandler {
	return &AssignOrderHandler{repo: repo}
}

func (h *AssignOrderHandler) Handle(ctx context.Context, cmd AssignOrderCommand) (*domain.Order, error) {
	order, err := h.repo.FindByID(cmd.OrderID)
	if err != nil {
		return nil, ErrOrderNotFound
	}

	order.AssignTo(cmd.UserID)

	if err := h.repo.Update(order); err != nil {
		return nil, err
	}

	return order, nil
}
