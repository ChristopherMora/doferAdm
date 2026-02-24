package products

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const productSelectColumns = `
	id, sku, name, description, stl_file_path,
	estimated_print_time_minutes, material, color, is_active, image_url,
	created_at, updated_at
`

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func sanitizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func scanProductRow(row pgx.Row) (*Product, error) {
	var product Product
	var description, stlFilePath, material, color, imageURL sql.NullString
	var estimatedPrintTime sql.NullInt32

	err := row.Scan(
		&product.ID,
		&product.SKU,
		&product.Name,
		&description,
		&stlFilePath,
		&estimatedPrintTime,
		&material,
		&color,
		&product.IsActive,
		&imageURL,
		&product.CreatedAt,
		&product.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if description.Valid {
		product.Description = &description.String
	}
	if stlFilePath.Valid {
		product.STLFilePath = &stlFilePath.String
	}
	if estimatedPrintTime.Valid {
		value := int(estimatedPrintTime.Int32)
		product.EstimatedPrintTimeMinutes = &value
	}
	if material.Valid {
		product.Material = &material.String
	}
	if color.Valid {
		product.Color = &color.String
	}
	if imageURL.Valid {
		product.ImageURL = &imageURL.String
	}

	return &product, nil
}

func (r *Repository) List(ctx context.Context, queryText string, active *bool, limit, offset int) ([]Product, error) {
	query := "SELECT " + productSelectColumns + " FROM products WHERE 1=1"
	args := []interface{}{}
	argNum := 1

	if strings.TrimSpace(queryText) != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR sku ILIKE $%d OR COALESCE(description, '') ILIKE $%d)", argNum, argNum, argNum)
		args = append(args, "%"+strings.TrimSpace(queryText)+"%")
		argNum++
	}

	if active != nil {
		query += fmt.Sprintf(" AND is_active = $%d", argNum)
		args = append(args, *active)
		argNum++
	}

	query += " ORDER BY created_at DESC"

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argNum)
		args = append(args, limit)
		argNum++
	}

	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argNum)
		args = append(args, offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]Product, 0)
	for rows.Next() {
		product, err := scanProductRow(rows)
		if err != nil {
			return nil, err
		}
		products = append(products, *product)
	}

	return products, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*Product, error) {
	row := r.db.QueryRow(ctx, "SELECT "+productSelectColumns+" FROM products WHERE id = $1", id)
	product, err := scanProductRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return product, nil
}

func (r *Repository) Create(ctx context.Context, req CreateProductRequest) (*Product, error) {
	sku := strings.TrimSpace(req.SKU)
	name := strings.TrimSpace(req.Name)
	if sku == "" {
		return nil, fmt.Errorf("sku is required")
	}
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	row := r.db.QueryRow(ctx, `
		INSERT INTO products (
			sku, name, description, stl_file_path, estimated_print_time_minutes,
			material, color, is_active, image_url
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING `+productSelectColumns,
		sku,
		name,
		sanitizeOptionalString(req.Description),
		sanitizeOptionalString(req.STLFilePath),
		req.EstimatedPrintTimeMinutes,
		sanitizeOptionalString(req.Material),
		sanitizeOptionalString(req.Color),
		isActive,
		sanitizeOptionalString(req.ImageURL),
	)

	return scanProductRow(row)
}

func (r *Repository) Update(ctx context.Context, id uuid.UUID, req UpdateProductRequest) (*Product, error) {
	query := "UPDATE products SET updated_at = CURRENT_TIMESTAMP"
	args := []interface{}{}
	argNum := 1

	if req.SKU != nil {
		sku := strings.TrimSpace(*req.SKU)
		if sku == "" {
			return nil, fmt.Errorf("sku cannot be empty")
		}
		query += fmt.Sprintf(", sku = $%d", argNum)
		args = append(args, sku)
		argNum++
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, fmt.Errorf("name cannot be empty")
		}
		query += fmt.Sprintf(", name = $%d", argNum)
		args = append(args, name)
		argNum++
	}

	if req.Description != nil {
		query += fmt.Sprintf(", description = $%d", argNum)
		args = append(args, sanitizeOptionalString(req.Description))
		argNum++
	}

	if req.STLFilePath != nil {
		query += fmt.Sprintf(", stl_file_path = $%d", argNum)
		args = append(args, sanitizeOptionalString(req.STLFilePath))
		argNum++
	}

	if req.EstimatedPrintTimeMinutes != nil {
		query += fmt.Sprintf(", estimated_print_time_minutes = $%d", argNum)
		args = append(args, req.EstimatedPrintTimeMinutes)
		argNum++
	}

	if req.Material != nil {
		query += fmt.Sprintf(", material = $%d", argNum)
		args = append(args, sanitizeOptionalString(req.Material))
		argNum++
	}

	if req.Color != nil {
		query += fmt.Sprintf(", color = $%d", argNum)
		args = append(args, sanitizeOptionalString(req.Color))
		argNum++
	}

	if req.ImageURL != nil {
		query += fmt.Sprintf(", image_url = $%d", argNum)
		args = append(args, sanitizeOptionalString(req.ImageURL))
		argNum++
	}

	if req.IsActive != nil {
		query += fmt.Sprintf(", is_active = $%d", argNum)
		args = append(args, *req.IsActive)
		argNum++
	}

	query += fmt.Sprintf(" WHERE id = $%d RETURNING %s", argNum, productSelectColumns)
	args = append(args, id)

	row := r.db.QueryRow(ctx, query, args...)
	return scanProductRow(row)
}

func (r *Repository) UpdateActive(ctx context.Context, id uuid.UUID, isActive bool) (*Product, error) {
	row := r.db.QueryRow(ctx,
		"UPDATE products SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING "+productSelectColumns,
		isActive,
		id,
	)
	return scanProductRow(row)
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM products WHERE id = $1", id)
	return err
}
