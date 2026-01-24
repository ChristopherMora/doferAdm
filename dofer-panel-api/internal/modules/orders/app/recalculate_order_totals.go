package app

import (
	"context"
	"fmt"

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

	fmt.Printf("DEBUG: Recalculating order %s - Found %d items\n", cmd.OrderID, len(items))

	newAmount := 0.0
	for _, item := range items {
		fmt.Printf("DEBUG: Item %s - Total: %.2f\n", item.ProductName, item.Total)
		newAmount += item.Total
	}

	// Calcular el total pagado desde los pagos
	payments, err := h.repo.GetPayments(cmd.OrderID)
	if err != nil {
		return err
	}

	fmt.Printf("DEBUG: Found %d payments\n", len(payments))

	newAmountPaid := 0.0
	for _, payment := range payments {
		fmt.Printf("DEBUG: Payment amount: %.2f\n", payment.Amount)
		newAmountPaid += payment.Amount
	}

	fmt.Printf("DEBUG: Final totals - Amount: %.2f, AmountPaid: %.2f, Balance: %.2f\n", newAmount, newAmountPaid, newAmount-newAmountPaid)

	// Actualizar la orden
	order.Amount = newAmount
	order.AmountPaid = newAmountPaid
	order.Balance = newAmount - newAmountPaid

	return h.repo.Update(order)
}
