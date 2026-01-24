package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type GetOrderPaymentsQuery struct {
	OrderID string
}

type GetOrderPaymentsHandler struct {
	repo domain.OrderRepository
}

func NewGetOrderPaymentsHandler(repo domain.OrderRepository) *GetOrderPaymentsHandler {
	return &GetOrderPaymentsHandler{repo: repo}
}

func (h *GetOrderPaymentsHandler) Handle(ctx context.Context, query GetOrderPaymentsQuery) ([]*domain.OrderPayment, error) {
	return h.repo.GetPayments(query.OrderID)
}
