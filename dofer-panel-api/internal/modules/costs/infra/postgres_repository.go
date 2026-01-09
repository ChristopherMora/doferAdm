package infra

import (
	"context"
	"database/sql"
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
		SELECT id, material_cost_per_gram, electricity_cost_per_hour, labor_cost_per_hour,
		       profit_margin_percentage, updated_at, COALESCE(updated_by, '') as updated_by
		FROM cost_settings
		LIMIT 1
	`

	var settings domain.CostSettings
	var updatedBy sql.NullString

	err := r.db.QueryRow(context.Background(), query).Scan(
		&settings.ID,
		&settings.MaterialCostPerGram,
		&settings.ElectricityCostPerHour,
		&settings.LaborCostPerHour,
		&settings.ProfitMarginPercentage,
		&settings.UpdatedAt,
		&updatedBy,
	)

	if err != nil {
		return nil, err
	}

	if updatedBy.Valid {
		settings.UpdatedBy = updatedBy.String
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
		    updated_at = $5,
		    updated_by = $6
		WHERE id = $7
	`

	_, err := r.db.Exec(context.Background(), query,
		settings.MaterialCostPerGram,
		settings.ElectricityCostPerHour,
		settings.LaborCostPerHour,
		settings.ProfitMarginPercentage,
		time.Now(),
		settings.UpdatedBy,
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
