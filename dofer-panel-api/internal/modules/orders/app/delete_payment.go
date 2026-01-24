package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type DeleteOrderPaymentCommand struct {
	OrderID   string
	PaymentID string
}

type DeleteOrderPaymentHandler struct {
	repo domain.OrderRepository
}

func NewDeleteOrderPaymentHandler(repo domain.OrderRepository) *DeleteOrderPaymentHandler {
	return &DeleteOrderPaymentHandler{repo: repo}
}

func (h *DeleteOrderPaymentHandler) Handle(ctx context.Context, cmd DeleteOrderPaymentCommand) error {
	// Obtener el pago antes de eliminarlo para saber cuánto restar
	payment, err := h.repo.GetPaymentByID(cmd.PaymentID)
	if err != nil {
		return err
	}

	// Eliminar el pago
	if err := h.repo.DeletePayment(cmd.PaymentID); err != nil {
		return err
	}

	// Obtener la orden
	order, err := h.repo.FindByID(cmd.OrderID)
	if err != nil {
		return err
	}

	// Recalcular totales
	newAmountPaid := order.AmountPaid - payment.Amount
	if newAmountPaid < 0 {
		newAmountPaid = 0
	}
	newBalance := order.Amount - newAmountPaid

	// Actualizar orden
	return h.repo.UpdateOrderPaymentTotals(cmd.OrderID, newAmountPaid, newBalance)
}
