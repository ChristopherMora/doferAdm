package app

import (
	"context"
	"errors"
	"time"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
	"github.com/google/uuid"
)

var (
	ErrInvalidPaymentAmount  = errors.New("payment amount must be greater than 0")
	ErrPaymentExceedsBalance = errors.New("payment amount exceeds remaining balance")
)

type AddPaymentCommand struct {
	QuoteID       string
	Amount        float64
	PaymentMethod string
	Notes         string
	CreatedBy     string
}

type AddPaymentHandler struct {
	repo domain.QuoteRepository
}

func NewAddPaymentHandler(repo domain.QuoteRepository) *AddPaymentHandler {
	return &AddPaymentHandler{repo: repo}
}

func (h *AddPaymentHandler) Handle(ctx context.Context, cmd AddPaymentCommand) (*domain.Quote, error) {
	organizationID := organizationIDFromContext(ctx)

	// Validar monto
	if cmd.Amount <= 0 {
		return nil, ErrInvalidPaymentAmount
	}

	// Obtener la cotización
	quote, err := h.repo.FindByID(cmd.QuoteID, organizationID)
	if err != nil {
		return nil, err
	}

	// Calcular nuevo monto pagado y balance
	newAmountPaid := quote.AmountPaid + cmd.Amount

	// Validar que no exceda el total
	if newAmountPaid > quote.Total {
		return nil, ErrPaymentExceedsBalance
	}

	now := time.Now()
	payment := &domain.QuotePayment{
		ID:             uuid.New().String(),
		OrganizationID: organizationID,
		QuoteID:        cmd.QuoteID,
		Amount:         cmd.Amount,
		PaymentMethod:  cmd.PaymentMethod,
		PaymentDate:    now,
		Notes:          cmd.Notes,
		CreatedBy:      cmd.CreatedBy,
		CreatedAt:      now,
	}
	if err := h.repo.AddPayment(payment); err != nil {
		return nil, err
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
