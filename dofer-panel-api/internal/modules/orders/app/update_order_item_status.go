package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type UpdateOrderItemStatusCommand struct {
	OrderID     string
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
	return h.repo.UpdateOrderItemStatus(cmd.OrderID, cmd.ItemID, organizationIDFromContext(ctx), cmd.IsCompleted)
}
