package app

import (
	"context"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/google/uuid"
)

type AddOrderPaymentCommand struct {
	OrderID       string
	Amount        float64
	PaymentMethod string
	PaymentDate   time.Time
	Notes         string
	CreatedBy     string
}

type AddOrderPaymentHandler struct {
	repo domain.OrderRepository
}

func NewAddOrderPaymentHandler(repo domain.OrderRepository) *AddOrderPaymentHandler {
	return &AddOrderPaymentHandler{repo: repo}
}

func (h *AddOrderPaymentHandler) Handle(ctx context.Context, cmd AddOrderPaymentCommand) (*domain.OrderPayment, error) {
	// Verificar que la orden existe
	order, err := h.repo.FindByID(cmd.OrderID)
	if err != nil {
		return nil, err
	}

	// Crear el pago
	payment := &domain.OrderPayment{
		ID:            uuid.New().String(),
		OrderID:       cmd.OrderID,
		Amount:        cmd.Amount,
		PaymentMethod: cmd.PaymentMethod,
		PaymentDate:   cmd.PaymentDate,
		Notes:         cmd.Notes,
		CreatedBy:     cmd.CreatedBy,
		CreatedAt:     time.Now(),
	}

	if err := h.repo.AddPayment(payment); err != nil {
		return nil, err
	}

	// Actualizar totales de la orden
	newAmountPaid := order.AmountPaid + cmd.Amount
	newBalance := order.Amount - newAmountPaid

	if err := h.repo.UpdateOrderPaymentTotals(cmd.OrderID, newAmountPaid, newBalance); err != nil {
		return nil, err
	}

	return payment, nil
}
