package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type GetOrderItemsQuery struct {
	OrderID string
}

type GetOrderItemsHandler struct {
	repo domain.OrderRepository
}

func NewGetOrderItemsHandler(repo domain.OrderRepository) *GetOrderItemsHandler {
	return &GetOrderItemsHandler{repo: repo}
}

func (h *GetOrderItemsHandler) Handle(ctx context.Context, query GetOrderItemsQuery) ([]*domain.OrderItem, error) {
	return h.repo.GetOrderItems(query.OrderID)
}
