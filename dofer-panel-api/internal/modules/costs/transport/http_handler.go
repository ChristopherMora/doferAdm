package transport

import (
	"encoding/json"
	"net/http"

	"github.com/dofer/panel-api/internal/modules/costs/app"
	"github.com/dofer/panel-api/internal/modules/costs/domain"
)

type CostHandler struct {
	getHandler       *app.GetCostSettingsHandler
	updateHandler    *app.UpdateCostSettingsHandler
	calculateHandler *app.CalculateCostHandler
}

func NewCostHandler(
	getHandler *app.GetCostSettingsHandler,
	updateHandler *app.UpdateCostSettingsHandler,
	calculateHandler *app.CalculateCostHandler,
) *CostHandler {
	return &CostHandler{
		getHandler:       getHandler,
		updateHandler:    updateHandler,
		calculateHandler: calculateHandler,
	}
}

type UpdateCostSettingsRequest struct {
	MaterialCostPerGram    float64 `json:"material_cost_per_gram"`
	ElectricityCostPerHour float64 `json:"electricity_cost_per_hour"`
	LaborCostPerHour       float64 `json:"labor_cost_per_hour"`
	ProfitMarginPercentage float64 `json:"profit_margin_percentage"`
}

type CalculateCostRequest struct {
	WeightGrams    float64 `json:"weight_grams"`
	PrintTimeHours float64 `json:"print_time_hours"`
	Quantity       int     `json:"quantity"`
	OtherCosts     float64 `json:"other_costs"`
}

func (h *CostHandler) GetCostSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.getHandler.Handle(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Convertir costo por gramo a costo por kilo (multiplicar por 1000) para mostrar al usuario
	settings.MaterialCostPerGram = settings.MaterialCostPerGram * 1000

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

func (h *CostHandler) GetAllMaterials(w http.ResponseWriter, r *http.Request) {
	materials, err := h.getHandler.HandleGetAll(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Convertir costo por gramo a costo por kilo para todos los materiales
	for i := range materials {
		materials[i].MaterialCostPerGram = materials[i].MaterialCostPerGram * 1000
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"materials": materials,
	})
}

func (h *CostHandler) UpdateCostSettings(w http.ResponseWriter, r *http.Request) {
	var req UpdateCostSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// TODO: Obtener usuario del contexto
	// Convertir costo por kilo a costo por gramo (dividir entre 1000)
	cmd := app.UpdateCostSettingsCommand{
		MaterialCostPerGram:    req.MaterialCostPerGram / 1000,
		ElectricityCostPerHour: req.ElectricityCostPerHour,
		LaborCostPerHour:       req.LaborCostPerHour,
		ProfitMarginPercentage: req.ProfitMarginPercentage,
		UpdatedBy:              "admin@test.com",
	}

	if err := h.updateHandler.Handle(r.Context(), cmd); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Settings updated successfully"})
}

func (h *CostHandler) CalculateCost(w http.ResponseWriter, r *http.Request) {
	var req CalculateCostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	input := domain.CalculationInput{
		WeightGrams:    req.WeightGrams,
		PrintTimeHours: req.PrintTimeHours,
		Quantity:       req.Quantity,
		OtherCosts:     req.OtherCosts,
	}

	breakdown, err := h.calculateHandler.Handle(r.Context(), input)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(breakdown)
}
