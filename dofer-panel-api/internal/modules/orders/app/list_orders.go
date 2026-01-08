package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type ListOrdersQuery struct {
	Status     string
	Platform   string
	AssignedTo string
	Limit      int
	Offset     int
}

type ListOrdersHandler struct {
	repo domain.OrderRepository
}

func NewListOrdersHandler(repo domain.OrderRepository) *ListOrdersHandler {
	return &ListOrdersHandler{repo: repo}
}

func (h *ListOrdersHandler) Handle(ctx context.Context, query ListOrdersQuery) ([]*domain.Order, error) {
	filters := domain.OrderFilters{
		Limit:  query.Limit,
		Offset: query.Offset,
	}

	if query.Status != "" {
		filters.Status = domain.OrderStatus(query.Status)
	}

	if query.Platform != "" {
		filters.Platform = domain.OrderPlatform(query.Platform)
	}

	if query.AssignedTo != "" {
		filters.AssignedTo = query.AssignedTo
	}

	if filters.Limit == 0 {
		filters.Limit = 50
	}

	return h.repo.FindAll(filters)
}
