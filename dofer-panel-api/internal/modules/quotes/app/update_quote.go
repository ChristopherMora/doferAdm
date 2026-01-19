package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type UpdateQuoteCommand struct {
	QuoteID       string
	CustomerName  *string
	CustomerEmail *string
	CustomerPhone *string
	Notes         *string
}

type UpdateQuoteHandler struct {
	repo domain.QuoteRepository
}

func NewUpdateQuoteHandler(repo domain.QuoteRepository) *UpdateQuoteHandler {
	return &UpdateQuoteHandler{repo: repo}
}

func (h *UpdateQuoteHandler) Handle(ctx context.Context, cmd UpdateQuoteCommand) (*domain.Quote, error) {
	// Get existing quote
	quote, err := h.repo.FindByID(cmd.QuoteID)
	if err != nil {
		return nil, err
	}

	// Update only provided fields
	if cmd.CustomerName != nil {
		quote.CustomerName = *cmd.CustomerName
	}
	if cmd.CustomerEmail != nil {
		quote.CustomerEmail = *cmd.CustomerEmail
	}
	if cmd.CustomerPhone != nil {
		quote.CustomerPhone = *cmd.CustomerPhone
	}
	if cmd.Notes != nil {
		quote.Notes = *cmd.Notes
	}

	// Save updates
	if err := h.repo.Update(quote); err != nil {
		return nil, err
	}

	return quote, nil
}
