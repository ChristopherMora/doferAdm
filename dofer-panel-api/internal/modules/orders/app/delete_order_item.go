package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type DeleteOrderItemCommand struct {
	OrderID string
	ItemID  string
}

type DeleteOrderItemHandler struct {
	repo domain.OrderRepository
}

func NewDeleteOrderItemHandler(repo domain.OrderRepository) *DeleteOrderItemHandler {
	return &DeleteOrderItemHandler{repo: repo}
}

func (h *DeleteOrderItemHandler) Handle(ctx context.Context, cmd DeleteOrderItemCommand) error {
	// Eliminar el item
	if err := h.repo.DeleteOrderItem(cmd.ItemID); err != nil {
		return err
	}

	// Recalcular el total de la orden
	order, err := h.repo.FindByID(cmd.OrderID)
	if err != nil {
		return err
	}

	items, err := h.repo.GetOrderItems(cmd.OrderID)
	if err != nil {
		return err
	}

	newAmount := 0.0
	for _, i := range items {
		newAmount += i.Total
	}

	// Actualizar el amount y balance de la orden
	order.Amount = newAmount
	order.Balance = newAmount - order.AmountPaid
	return h.repo.Update(order)
}
