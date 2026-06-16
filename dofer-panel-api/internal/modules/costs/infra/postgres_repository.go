package infra

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/dofer/panel-api/internal/modules/costs/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresCostSettingsRepository struct {
	db *pgxpool.Pool
}

func NewPostgresCostSettingsRepository(db *pgxpool.Pool) *PostgresCostSettingsRepository {
	return &PostgresCostSettingsRepository{db: db}
}

func (r *PostgresCostSettingsRepository) Get(organizationID ...string) (*domain.CostSettings, error) {
	query := `
		SELECT id, organization_id, material_name, material_cost_per_gram, electricity_cost_per_hour, labor_cost_per_hour,
		       profit_margin_percentage, updated_at
		FROM cost_settings
		WHERE ($1 = '' OR organization_id = $1)
		ORDER BY updated_at DESC
		LIMIT 1
	`

	var settings domain.CostSettings
	orgID := ""
	if len(organizationID) > 0 {
		orgID = organizationID[0]
	}

	err := r.db.QueryRow(context.Background(), query, orgID).Scan(
		&settings.ID,
		&settings.OrganizationID,
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

func (r *PostgresCostSettingsRepository) GetAll(organizationID ...string) ([]domain.CostSettings, error) {
	query := `
		SELECT id, organization_id, material_name, material_cost_per_gram, electricity_cost_per_hour, labor_cost_per_hour,
		       profit_margin_percentage, updated_at
		FROM cost_settings
		WHERE ($1 = '' OR organization_id = $1)
		ORDER BY material_name
	`

	orgID := ""
	if len(organizationID) > 0 {
		orgID = organizationID[0]
	}

	rows, err := r.db.Query(context.Background(), query, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var materials []domain.CostSettings

	for rows.Next() {
		var settings domain.CostSettings
		err := rows.Scan(
			&settings.ID,
			&settings.OrganizationID,
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

func (r *PostgresCostSettingsRepository) GetByMaterial(materialName string, organizationID ...string) (*domain.CostSettings, error) {
	query := `
		SELECT id, organization_id, material_name, material_cost_per_gram, electricity_cost_per_hour, labor_cost_per_hour,
		       profit_margin_percentage, updated_at
		FROM cost_settings
		WHERE material_name = $1
		  AND ($2 = '' OR organization_id = $2)
		LIMIT 1
	`

	var settings domain.CostSettings
	orgID := ""
	if len(organizationID) > 0 {
		orgID = organizationID[0]
	}

	err := r.db.QueryRow(context.Background(), query, materialName, orgID).Scan(
		&settings.ID,
		&settings.OrganizationID,
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
		  AND ($7 = '' OR organization_id = $7)
	`

	_, err := r.db.Exec(context.Background(), query,
		settings.MaterialCostPerGram,
		settings.ElectricityCostPerHour,
		settings.LaborCostPerHour,
		settings.ProfitMarginPercentage,
		time.Now(),
		settings.ID,
		settings.OrganizationID,
	)

	return err
}

func (r *PostgresCostSettingsRepository) CalculateCost(input domain.CalculationInput) (*domain.CostBreakdown, error) {
	var (
		settings *domain.CostSettings
		err      error
	)

	materialName := strings.TrimSpace(input.MaterialName)
	if materialName != "" {
		settings, err = r.GetByMaterial(materialName, input.OrganizationID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("%w: %s", domain.ErrMaterialNotFound, materialName)
			}
			return nil, err
		}
	} else {
		settings, err = r.Get(input.OrganizationID)
		if err != nil {
			return nil, err
		}
	}

	// Calcular costos con redondeo monetario consistente.
	materialCost := roundMoney(input.WeightGrams * settings.MaterialCostPerGram)
	laborCost := roundMoney(input.PrintTimeHours * settings.LaborCostPerHour)
	electricityCost := roundMoney(input.PrintTimeHours * settings.ElectricityCostPerHour)
	otherCosts := roundMoney(input.OtherCosts)

	subtotal := roundMoney(materialCost + laborCost + electricityCost + otherCosts)
	profitMargin := roundMoney(subtotal * (settings.ProfitMarginPercentage / 100))
	unitPrice := roundMoney(subtotal + profitMargin)
	total := roundMoney(unitPrice * float64(input.Quantity))

	return &domain.CostBreakdown{
		MaterialCost:    materialCost,
		LaborCost:       laborCost,
		ElectricityCost: electricityCost,
		OtherCosts:      otherCosts,
		Subtotal:        subtotal,
		ProfitMargin:    profitMargin,
		UnitPrice:       unitPrice,
		Total:           total,
		MaterialName:    settings.MaterialName,
	}, nil
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}
