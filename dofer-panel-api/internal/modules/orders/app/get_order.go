package app

import (
	"context"
	"fmt"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type GetOrderQuery struct {
	OrderID string
}

type GetOrderHandler struct {
	repo domain.OrderRepository
}

func NewGetOrderHandler(repo domain.OrderRepository) *GetOrderHandler {
	return &GetOrderHandler{repo: repo}
}

func (h *GetOrderHandler) Handle(ctx context.Context, query GetOrderQuery) (*domain.Order, error) {
	if query.OrderID == "" {
		return nil, fmt.Errorf("order ID is required")
	}

	order, err := h.repo.FindByID(query.OrderID)
	if err != nil {
		return nil, fmt.Errorf("failed to find order: %w", err)
	}

	if order == nil {
		return nil, fmt.Errorf("order not found")
	}

	return order, nil
}
