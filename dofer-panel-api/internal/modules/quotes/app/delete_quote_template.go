package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type DeleteQuoteTemplateCommand struct {
	TemplateID string
}

type DeleteQuoteTemplateHandler struct {
	repo domain.QuoteRepository
}

func NewDeleteQuoteTemplateHandler(repo domain.QuoteRepository) *DeleteQuoteTemplateHandler {
	return &DeleteQuoteTemplateHandler{repo: repo}
}

func (h *DeleteQuoteTemplateHandler) Handle(ctx context.Context, cmd DeleteQuoteTemplateCommand) error {
	_ = ctx
	return h.repo.DeleteTemplate(cmd.TemplateID)
}
