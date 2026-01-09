package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type ListQuotesHandler struct {
	repo domain.QuoteRepository
}

func NewListQuotesHandler(repo domain.QuoteRepository) *ListQuotesHandler {
	return &ListQuotesHandler{repo: repo}
}

func (h *ListQuotesHandler) Handle(ctx context.Context) ([]*domain.Quote, error) {
	return h.repo.FindAll(nil)
}
