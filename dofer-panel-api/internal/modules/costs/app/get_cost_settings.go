package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/costs/domain"
)

type GetCostSettingsHandler struct {
	repo domain.CostSettingsRepository
}

func NewGetCostSettingsHandler(repo domain.CostSettingsRepository) *GetCostSettingsHandler {
	return &GetCostSettingsHandler{repo: repo}
}

func (h *GetCostSettingsHandler) Handle(ctx context.Context) (*domain.CostSettings, error) {
	return h.repo.Get()
}
