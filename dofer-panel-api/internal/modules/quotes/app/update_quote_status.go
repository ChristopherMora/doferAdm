package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type UpdateQuoteStatusCommand struct {
	QuoteID string
	Status  string // approved, rejected, expired
}

type UpdateQuoteStatusHandler struct {
	repo domain.QuoteRepository
}

func NewUpdateQuoteStatusHandler(repo domain.QuoteRepository) *UpdateQuoteStatusHandler {
	return &UpdateQuoteStatusHandler{repo: repo}
}

func (h *UpdateQuoteStatusHandler) Handle(ctx context.Context, cmd UpdateQuoteStatusCommand) error {
	quote, err := h.repo.FindByID(cmd.QuoteID)
	if err != nil {
		return err
	}

	quote.Status = cmd.Status

	return h.repo.Update(quote)
}
