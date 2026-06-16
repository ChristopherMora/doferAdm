package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

type ListOrderRequestsHandler struct {
	repo domain.AffiliateRepository
}

func NewListOrderRequestsHandler(repo domain.AffiliateRepository) *ListOrderRequestsHandler {
	return &ListOrderRequestsHandler{repo: repo}
}

func (h *ListOrderRequestsHandler) Handle(ctx context.Context, filters domain.OrderRequestFilters) ([]*domain.AffiliateOrderRequest, error) {
	if filters.OrganizationID == "" {
		filters.OrganizationID = organizationIDFromContext(ctx)
	}
	return h.repo.ListOrderRequests(filters)
}

type GetOrderRequestHandler struct {
	repo domain.AffiliateRepository
}

func NewGetOrderRequestHandler(repo domain.AffiliateRepository) *GetOrderRequestHandler {
	return &GetOrderRequestHandler{repo: repo}
}

func (h *GetOrderRequestHandler) Handle(ctx context.Context, id string) (*domain.AffiliateOrderRequest, error) {
	return h.repo.FindOrderRequestByID(id, organizationIDFromContext(ctx))
}
