package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/costs/domain"
)

type UpdateCostSettingsCommand struct {
	MaterialCostPerGram    float64
	ElectricityCostPerHour float64
	LaborCostPerHour       float64
	ProfitMarginPercentage float64
	UpdatedBy              string
}

type UpdateCostSettingsHandler struct {
	repo domain.CostSettingsRepository
}

func NewUpdateCostSettingsHandler(repo domain.CostSettingsRepository) *UpdateCostSettingsHandler {
	return &UpdateCostSettingsHandler{repo: repo}
}

func (h *UpdateCostSettingsHandler) Handle(ctx context.Context, cmd UpdateCostSettingsCommand) error {
	// Obtener settings actuales
	settings, err := h.repo.Get()
	if err != nil {
		return err
	}

	// Actualizar valores
	settings.MaterialCostPerGram = cmd.MaterialCostPerGram
	settings.ElectricityCostPerHour = cmd.ElectricityCostPerHour
	settings.LaborCostPerHour = cmd.LaborCostPerHour
	settings.ProfitMarginPercentage = cmd.ProfitMarginPercentage
	settings.UpdatedBy = cmd.UpdatedBy

	return h.repo.Update(settings)
}
