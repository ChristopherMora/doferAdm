package infra

import (
	"context"
	"time"

	"github.com/dofer/panel-api/internal/modules/costs/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresCostSettingsRepository struct {
	db *pgxpool.Pool
}

func NewPostgresCostSettingsRepository(db *pgxpool.Pool) *PostgresCostSettingsRepository {
	return &PostgresCostSettingsRepository{db: db}
}

func (r *PostgresCostSettingsRepository) Get() (*domain.CostSettings, error) {
	query := `
		SELECT id, material_name, material_cost_per_gram, electricity_cost_per_hour, labor_cost_per_hour,
		       profit_margin_percentage, updated_at
		FROM cost_settings
		LIMIT 1
	`

	var settings domain.CostSettings

	err := r.db.QueryRow(context.Background(), query).Scan(
		&settings.ID,
		&settings.MaterialName,
		&settings.MaterialCostPerGram,
		&settings.ElectricityCostPerHour,
		&settings.LaborCostPerHour,
		&settings.ProfitMarginPercentage,
		&settings.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &settings, nil
}

func (r *PostgresCostSettingsRepository) GetAll() ([]domain.CostSettings, error) {
	query := `
		SELECT id, material_name, material_cost_per_gram, electricity_cost_per_hour, labor_cost_per_hour,
		       profit_margin_percentage, updated_at
		FROM cost_settings
		ORDER BY material_name
	`

	rows, err := r.db.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var materials []domain.CostSettings

	for rows.Next() {
		var settings domain.CostSettings
		err := rows.Scan(
			&settings.ID,
			&settings.MaterialName,
			&settings.MaterialCostPerGram,
			&settings.ElectricityCostPerHour,
			&settings.LaborCostPerHour,
			&settings.ProfitMarginPercentage,
			&settings.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		materials = append(materials, settings)
	}

	return materials, nil
}

func (r *PostgresCostSettingsRepository) GetByMaterial(materialName string) (*domain.CostSettings, error) {
	query := `
		SELECT id, material_name, material_cost_per_gram, electricity_cost_per_hour, labor_cost_per_hour,
		       profit_margin_percentage, updated_at
		FROM cost_settings
		WHERE material_name = $1
		LIMIT 1
	`

	var settings domain.CostSettings

	err := r.db.QueryRow(context.Background(), query, materialName).Scan(
		&settings.ID,
		&settings.MaterialName,
		&settings.MaterialCostPerGram,
		&settings.ElectricityCostPerHour,
		&settings.LaborCostPerHour,
		&settings.ProfitMarginPercentage,
		&settings.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &settings, nil
}

func (r *PostgresCostSettingsRepository) Update(settings *domain.CostSettings) error {
	query := `
		UPDATE cost_settings
		SET material_cost_per_gram = $1,
		    electricity_cost_per_hour = $2,
		    labor_cost_per_hour = $3,
		    profit_margin_percentage = $4,
		    updated_at = $5
		WHERE id = $6
	`

	_, err := r.db.Exec(context.Background(), query,
		settings.MaterialCostPerGram,
		settings.ElectricityCostPerHour,
		settings.LaborCostPerHour,
		settings.ProfitMarginPercentage,
		time.Now(),
		settings.ID,
	)

	return err
}

func (r *PostgresCostSettingsRepository) CalculateCost(input domain.CalculationInput) (*domain.CostBreakdown, error) {
	settings, err := r.Get()
	if err != nil {
		return nil, err
	}

	// Calcular costos individuales
	materialCost := input.WeightGrams * settings.MaterialCostPerGram
	laborCost := input.PrintTimeHours * settings.LaborCostPerHour
	electricityCost := input.PrintTimeHours * settings.ElectricityCostPerHour

	// Subtotal de costos
	subtotal := materialCost + laborCost + electricityCost + input.OtherCosts

	// Aplicar margen de ganancia
	profitMargin := subtotal * (settings.ProfitMarginPercentage / 100)
	unitPrice := subtotal + profitMargin

	// Calcular total con cantidad
	total := unitPrice * float64(input.Quantity)

	return &domain.CostBreakdown{
		MaterialCost:    materialCost,
		LaborCost:       laborCost,
		ElectricityCost: electricityCost,
		OtherCosts:      input.OtherCosts,
		Subtotal:        subtotal,
		ProfitMargin:    profitMargin,
		UnitPrice:       unitPrice,
		Total:           total,
	}, nil
}
