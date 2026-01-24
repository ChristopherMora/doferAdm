package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type RecalculateOrderTotalsCommand struct {
	OrderID string
}

type RecalculateOrderTotalsHandler struct {
	repo domain.OrderRepository
}

func NewRecalculateOrderTotalsHandler(repo domain.OrderRepository) *RecalculateOrderTotalsHandler {
	return &RecalculateOrderTotalsHandler{repo: repo}
}

func (h *RecalculateOrderTotalsHandler) Handle(ctx context.Context, cmd RecalculateOrderTotalsCommand) error {
	// Obtener la orden
	order, err := h.repo.FindByID(cmd.OrderID)
	if err != nil {
		return err
	}

	// Calcular el total desde los items
	items, err := h.repo.GetOrderItems(cmd.OrderID)
	if err != nil {
		return err
	}

	newAmount := 0.0
	for _, item := range items {
		newAmount += item.Total
	}

	// Calcular el total pagado desde los pagos
	payments, err := h.repo.GetPayments(cmd.OrderID)
	if err != nil {
		return err
	}

	newAmountPaid := 0.0
	for _, payment := range payments {
		newAmountPaid += payment.Amount
	}

	// Actualizar la orden
	order.Amount = newAmount
	order.AmountPaid = newAmountPaid
	order.Balance = newAmount - newAmountPaid

	return h.repo.Update(order)
}
