package domain

import (
	"errors"
	"time"
)

var ErrMaterialNotFound = errors.New("material not found")

type CostSettings struct {
	ID                     string    `json:"id"`
	MaterialName           string    `json:"material_name"`
	MaterialCostPerGram    float64   `json:"material_cost_per_gram"`
	ElectricityCostPerHour float64   `json:"electricity_cost_per_hour"`
	LaborCostPerHour       float64   `json:"labor_cost_per_hour"`
	ProfitMarginPercentage float64   `json:"profit_margin_percentage"`
	UpdatedAt              time.Time `json:"updated_at"`
	UpdatedBy              string    `json:"updated_by,omitempty"`
}

type CalculationInput struct {
	WeightGrams    float64 `json:"weight_grams"`
	PrintTimeHours float64 `json:"print_time_hours"`
	Quantity       int     `json:"quantity"`
	OtherCosts     float64 `json:"other_costs"`
	MaterialName   string  `json:"material_name,omitempty"`
}

type CostBreakdown struct {
	MaterialCost    float64 `json:"material_cost"`
	LaborCost       float64 `json:"labor_cost"`
	ElectricityCost float64 `json:"electricity_cost"`
	OtherCosts      float64 `json:"other_costs"`
	Subtotal        float64 `json:"subtotal"`
	ProfitMargin    float64 `json:"profit_margin"`
	UnitPrice       float64 `json:"unit_price"`
	Total           float64 `json:"total"`
	MaterialName    string  `json:"material_name,omitempty"`
}

type CostSettingsRepository interface {
	Get() (*CostSettings, error)
	GetAll() ([]CostSettings, error)
	GetByMaterial(materialName string) (*CostSettings, error)
	Update(settings *CostSettings) error
	CalculateCost(input CalculationInput) (*CostBreakdown, error)
}
