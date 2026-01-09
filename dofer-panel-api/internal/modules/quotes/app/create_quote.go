package app

import (
	"context"
	"time"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
	"github.com/dofer/panel-api/internal/modules/quotes/infra"
	"github.com/google/uuid"
)

type CreateQuoteCommand struct {
	CustomerName  string
	CustomerEmail string
	CustomerPhone string
	Notes         string
	ValidUntil    time.Time
	CreatedBy     string
}

type CreateQuoteHandler struct {
	repo domain.QuoteRepository
}

func NewCreateQuoteHandler(repo domain.QuoteRepository) *CreateQuoteHandler {
	return &CreateQuoteHandler{repo: repo}
}

func (h *CreateQuoteHandler) Handle(ctx context.Context, cmd CreateQuoteCommand) (*domain.Quote, error) {
	quote := &domain.Quote{
		ID:            uuid.New().String(),
		QuoteNumber:   infra.GenerateQuoteNumber(),
		CustomerName:  cmd.CustomerName,
		CustomerEmail: cmd.CustomerEmail,
		CustomerPhone: cmd.CustomerPhone,
		Status:        "pending",
		Subtotal:      0,
		Discount:      0,
		Tax:           0,
		Total:         0,
		Notes:         cmd.Notes,
		ValidUntil:    cmd.ValidUntil,
		CreatedBy:     cmd.CreatedBy,
	}

	if err := h.repo.Create(quote); err != nil {
		return nil, err
	}

	return quote, nil
}
