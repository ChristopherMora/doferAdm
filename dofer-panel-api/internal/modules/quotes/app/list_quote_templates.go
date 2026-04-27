package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type ListQuoteTemplatesHandler struct {
	repo domain.QuoteRepository
}

func NewListQuoteTemplatesHandler(repo domain.QuoteRepository) *ListQuoteTemplatesHandler {
	return &ListQuoteTemplatesHandler{repo: repo}
}

func (h *ListQuoteTemplatesHandler) Handle(ctx context.Context) ([]*domain.QuoteTemplate, error) {
	return h.repo.FindAllTemplates(map[string]interface{}{
		"organization_id": organizationIDFromContext(ctx),
	})
}
