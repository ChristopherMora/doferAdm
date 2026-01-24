package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type DeleteOrderItemCommand struct {
	ItemID string
}

type DeleteOrderItemHandler struct {
	repo domain.OrderRepository
}

func NewDeleteOrderItemHandler(repo domain.OrderRepository) *DeleteOrderItemHandler {
	return &DeleteOrderItemHandler{repo: repo}
}

func (h *DeleteOrderItemHandler) Handle(ctx context.Context, cmd DeleteOrderItemCommand) error {
	return h.repo.DeleteOrderItem(cmd.ItemID)
}
