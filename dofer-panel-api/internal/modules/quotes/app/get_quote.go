package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

type GetQuoteHandler struct {
	repo domain.QuoteRepository
}

func NewGetQuoteHandler(repo domain.QuoteRepository) *GetQuoteHandler {
	return &GetQuoteHandler{repo: repo}
}

func (h *GetQuoteHandler) Handle(ctx context.Context, id string) (*domain.Quote, []*domain.QuoteItem, error) {
	quote, err := h.repo.FindByID(id)
	if err != nil {
		return nil, nil, err
	}

	items, err := h.repo.GetItems(id)
	if err != nil {
		return nil, nil, err
	}

	return quote, items, nil
}
