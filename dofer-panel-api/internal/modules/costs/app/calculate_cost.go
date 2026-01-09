package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/costs/domain"
)

type CalculateCostHandler struct {
	repo domain.CostSettingsRepository
}

func NewCalculateCostHandler(repo domain.CostSettingsRepository) *CalculateCostHandler {
	return &CalculateCostHandler{repo: repo}
}

func (h *CalculateCostHandler) Handle(ctx context.Context, input domain.CalculationInput) (*domain.CostBreakdown, error) {
	return h.repo.CalculateCost(input)
}
