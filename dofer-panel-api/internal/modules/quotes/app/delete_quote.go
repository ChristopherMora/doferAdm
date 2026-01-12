package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type DeleteQuoteCommand struct {
	QuoteID string
}

type DeleteQuoteHandler struct {
	repo domain.QuoteRepository
}

func NewDeleteQuoteHandler(repo domain.QuoteRepository) *DeleteQuoteHandler {
	return &DeleteQuoteHandler{repo: repo}
}

func (h *DeleteQuoteHandler) Handle(ctx context.Context, cmd DeleteQuoteCommand) error {
	return h.repo.Delete(cmd.QuoteID)
}
