package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type GetOrderHistoryQuery struct {
	OrderID string
}

type GetOrderHistoryHandler struct {
	historyRepo domain.OrderHistoryRepository
}

func NewGetOrderHistoryHandler(historyRepo domain.OrderHistoryRepository) *GetOrderHistoryHandler {
	return &GetOrderHistoryHandler{historyRepo: historyRepo}
}

func (h *GetOrderHistoryHandler) Handle(ctx context.Context, query GetOrderHistoryQuery) ([]*domain.OrderHistoryEntry, error) {
	return h.historyRepo.FindByOrderID(query.OrderID)
}
