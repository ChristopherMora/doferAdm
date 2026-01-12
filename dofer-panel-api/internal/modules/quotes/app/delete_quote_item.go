package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type DeleteQuoteItemCommand struct {
	QuoteID string
	ItemID  string
}

type DeleteQuoteItemHandler struct {
	repo domain.QuoteRepository
}

func NewDeleteQuoteItemHandler(repo domain.QuoteRepository) *DeleteQuoteItemHandler {
	return &DeleteQuoteItemHandler{repo: repo}
}

func (h *DeleteQuoteItemHandler) Handle(ctx context.Context, cmd DeleteQuoteItemCommand) error {
	return h.repo.DeleteQuoteItem(ctx, cmd.QuoteID, cmd.ItemID)
}
