package infra

import (
	"context"
	"database/sql"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
	"github.com/jackc/pgx/v5"
)

func (r *PostgresQuoteRepository) CreateTemplate(template *domain.QuoteTemplate) error {
	query := `
		INSERT INTO quote_templates (
			id, name, description, material,
			infill_percentage, layer_height, print_speed, base_cost, markup_percentage, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := r.db.Exec(context.Background(), query,
		template.ID,
		template.Name,
		template.Description,
		template.Material,
		template.InfillPercentage,
		template.LayerHeight,
		template.PrintSpeed,
		template.BaseCost,
		template.MarkupPercentage,
		template.CreatedBy,
	)

	return err
}

func (r *PostgresQuoteRepository) FindTemplateByID(id string) (*domain.QuoteTemplate, error) {
	query := `
		SELECT id, name, description, material,
		       infill_percentage, layer_height, print_speed, base_cost, markup_percentage,
		       created_by, created_at, updated_at
		FROM quote_templates
		WHERE id = $1
	`

	var template domain.QuoteTemplate
	var description, createdBy sql.NullString

	err := r.db.QueryRow(context.Background(), query, id).Scan(
		&template.ID,
		&template.Name,
		&description,
		&template.Material,
		&template.InfillPercentage,
		&template.LayerHeight,
		&template.PrintSpeed,
		&template.BaseCost,
		&template.MarkupPercentage,
		&createdBy,
		&template.CreatedAt,
		&template.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if description.Valid {
		template.Description = description.String
	}
	if createdBy.Valid {
		template.CreatedBy = createdBy.String
	}

	return &template, nil
}

func (r *PostgresQuoteRepository) FindAllTemplates(filters map[string]interface{}) ([]*domain.QuoteTemplate, error) {
	query := `
		SELECT id, name, description, material,
		       infill_percentage, layer_height, print_speed, base_cost, markup_percentage,
		       created_by, created_at, updated_at
		FROM quote_templates
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	templates := make([]*domain.QuoteTemplate, 0)
	for rows.Next() {
		var template domain.QuoteTemplate
		var description, createdBy sql.NullString

		err := rows.Scan(
			&template.ID,
			&template.Name,
			&description,
			&template.Material,
			&template.InfillPercentage,
			&template.LayerHeight,
			&template.PrintSpeed,
			&template.BaseCost,
			&template.MarkupPercentage,
			&createdBy,
			&template.CreatedAt,
			&template.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if description.Valid {
			template.Description = description.String
		}
		if createdBy.Valid {
			template.CreatedBy = createdBy.String
		}

		templates = append(templates, &template)
	}

	return templates, rows.Err()
}

func (r *PostgresQuoteRepository) UpdateTemplate(template *domain.QuoteTemplate) error {
	query := `
		UPDATE quote_templates
		SET name = $1,
		    description = $2,
		    material = $3,
		    infill_percentage = $4,
		    layer_height = $5,
		    print_speed = $6,
		    base_cost = $7,
		    markup_percentage = $8,
		    updated_at = NOW()
		WHERE id = $9
	`

	result, err := r.db.Exec(context.Background(), query,
		template.Name,
		template.Description,
		template.Material,
		template.InfillPercentage,
		template.LayerHeight,
		template.PrintSpeed,
		template.BaseCost,
		template.MarkupPercentage,
		template.ID,
	)

	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	return nil
}

func (r *PostgresQuoteRepository) DeleteTemplate(id string) error {
	result, err := r.db.Exec(context.Background(), "DELETE FROM quote_templates WHERE id = $1", id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	return nil
}
