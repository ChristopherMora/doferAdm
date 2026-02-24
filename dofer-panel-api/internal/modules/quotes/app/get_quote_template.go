package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type GetQuoteTemplateHandler struct {
	repo domain.QuoteRepository
}

func NewGetQuoteTemplateHandler(repo domain.QuoteRepository) *GetQuoteTemplateHandler {
	return &GetQuoteTemplateHandler{repo: repo}
}

func (h *GetQuoteTemplateHandler) Handle(ctx context.Context, templateID string) (*domain.QuoteTemplate, error) {
	_ = ctx
	return h.repo.FindTemplateByID(templateID)
}
