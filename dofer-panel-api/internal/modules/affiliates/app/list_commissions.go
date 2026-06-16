package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

type ListCommissionsHandler struct {
	repo domain.AffiliateRepository
}

func NewListCommissionsHandler(repo domain.AffiliateRepository) *ListCommissionsHandler {
	return &ListCommissionsHandler{repo: repo}
}

func (h *ListCommissionsHandler) Handle(ctx context.Context, filters domain.CommissionFilters) ([]*domain.AffiliateCommission, error) {
	return h.repo.ListCommissions(filters)
}
