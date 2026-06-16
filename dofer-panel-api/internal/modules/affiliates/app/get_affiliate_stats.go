package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

type GetAffiliateStatsHandler struct {
	repo domain.AffiliateRepository
}

func NewGetAffiliateStatsHandler(repo domain.AffiliateRepository) *GetAffiliateStatsHandler {
	return &GetAffiliateStatsHandler{repo: repo}
}

func (h *GetAffiliateStatsHandler) Handle(ctx context.Context, affiliateID string) (*domain.AffiliateStats, error) {
	return h.repo.GetAffiliateStats(affiliateID)
}
