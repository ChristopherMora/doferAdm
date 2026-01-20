package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type UpdateOrderItemStatusCommand struct {
	ItemID      string
	IsCompleted bool
}

type UpdateOrderItemStatusHandler struct {
	repo domain.OrderRepository
}

func NewUpdateOrderItemStatusHandler(repo domain.OrderRepository) *UpdateOrderItemStatusHandler {
	return &UpdateOrderItemStatusHandler{repo: repo}
}

func (h *UpdateOrderItemStatusHandler) Handle(ctx context.Context, cmd UpdateOrderItemStatusCommand) error {
	return h.repo.UpdateOrderItemStatus(cmd.ItemID, cmd.IsCompleted)
}
