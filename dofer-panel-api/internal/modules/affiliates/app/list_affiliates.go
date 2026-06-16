package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

type ListAffiliatesHandler struct {
	repo domain.AffiliateRepository
}

func NewListAffiliatesHandler(repo domain.AffiliateRepository) *ListAffiliatesHandler {
	return &ListAffiliatesHandler{repo: repo}
}

func (h *ListAffiliatesHandler) Handle(ctx context.Context, filters domain.AffiliateFilters) ([]*domain.Affiliate, error) {
	if filters.OrganizationID == "" {
		filters.OrganizationID = organizationIDFromContext(ctx)
	}
	return h.repo.ListAffiliates(filters)
}
