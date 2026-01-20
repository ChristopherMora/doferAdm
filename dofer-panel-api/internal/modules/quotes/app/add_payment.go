package app

import (
	"context"
	"errors"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

var (
	ErrInvalidPaymentAmount = errors.New("payment amount must be greater than 0")
	ErrPaymentExceedsBalance = errors.New("payment amount exceeds remaining balance")
)

type AddPaymentCommand struct {
	QuoteID string
	Amount  float64
}

type AddPaymentHandler struct {
	repo domain.QuoteRepository
}

func NewAddPaymentHandler(repo domain.QuoteRepository) *AddPaymentHandler {
	return &AddPaymentHandler{repo: repo}
}

func (h *AddPaymentHandler) Handle(ctx context.Context, cmd AddPaymentCommand) (*domain.Quote, error) {
	// Validar monto
	if cmd.Amount <= 0 {
		return nil, ErrInvalidPaymentAmount
	}

	// Obtener la cotización
	quote, err := h.repo.FindByID(cmd.QuoteID)
	if err != nil {
		return nil, err
	}

	// Calcular nuevo monto pagado y balance
	newAmountPaid := quote.AmountPaid + cmd.Amount
	
	// Validar que no exceda el total
	if newAmountPaid > quote.Total {
		return nil, ErrPaymentExceedsBalance
	}

	// Actualizar montos
	quote.AmountPaid = newAmountPaid
	quote.Balance = quote.Total - quote.AmountPaid

	// Guardar
	if err := h.repo.Update(quote); err != nil {
		return nil, err
	}

	return quote, nil
}
