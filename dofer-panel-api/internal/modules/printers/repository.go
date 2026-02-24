package printers

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var allowedPrinterStatus = map[string]struct{}{
	"available":   {},
	"busy":        {},
	"maintenance": {},
	"offline":     {},
}

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func normalizePrinterStatus(raw string) (string, error) {
	status := strings.ToLower(strings.TrimSpace(raw))
	if status == "" {
		status = "available"
	}

	if _, ok := allowedPrinterStatus[status]; !ok {
		return "", fmt.Errorf("invalid printer status: %s", raw)
	}

	return status, nil
}

func (r *Repository) List(ctx context.Context, status string, limit, offset int) ([]Printer, error) {
	query := "SELECT * FROM printers WHERE 1=1"
	args := []interface{}{}
	argNum := 1

	if strings.TrimSpace(status) != "" {
		normalizedStatus, err := normalizePrinterStatus(status)
		if err != nil {
			return nil, err
		}
		query += fmt.Sprintf(" AND status = $%d", argNum)
		args = append(args, normalizedStatus)
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

	printers, err := pgx.CollectRows(rows, pgx.RowToStructByName[Printer])
	return printers, err
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*Printer, error) {
	rows, err := r.db.Query(ctx, "SELECT * FROM printers WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	printer, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Printer])
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &printer, nil
}

func (r *Repository) Create(ctx context.Context, req CreatePrinterRequest) (*Printer, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("name is required")
	}

	status, err := normalizePrinterStatus(req.Status)
	if err != nil {
		return nil, err
	}

	query := `
		INSERT INTO printers (name, model, material, status)
		VALUES ($1, $2, $3, $4)
		RETURNING *
	`

	rows, err := r.db.Query(ctx, query, strings.TrimSpace(req.Name), req.Model, req.Material, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	printer, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Printer])
	if err != nil {
		return nil, err
	}

	return &printer, nil
}

func (r *Repository) Update(ctx context.Context, id uuid.UUID, req UpdatePrinterRequest) (*Printer, error) {
	query := "UPDATE printers SET updated_at = CURRENT_TIMESTAMP"
	args := []interface{}{}
	argNum := 1

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, fmt.Errorf("name cannot be empty")
		}
		query += fmt.Sprintf(", name = $%d", argNum)
		args = append(args, name)
		argNum++
	}

	if req.Model != nil {
		query += fmt.Sprintf(", model = $%d", argNum)
		args = append(args, strings.TrimSpace(*req.Model))
		argNum++
	}

	if req.Material != nil {
		query += fmt.Sprintf(", material = $%d", argNum)
		args = append(args, strings.TrimSpace(*req.Material))
		argNum++
	}

	if req.Status != nil {
		status, err := normalizePrinterStatus(*req.Status)
		if err != nil {
			return nil, err
		}
		query += fmt.Sprintf(", status = $%d", argNum)
		args = append(args, status)
		argNum++
	}

	query += fmt.Sprintf(" WHERE id = $%d RETURNING *", argNum)
	args = append(args, id)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	printer, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Printer])
	if err != nil {
		return nil, err
	}

	return &printer, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) (*Printer, error) {
	normalizedStatus, err := normalizePrinterStatus(status)
	if err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx,
		"UPDATE printers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
		normalizedStatus,
		id,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	printer, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Printer])
	if err != nil {
		return nil, err
	}

	return &printer, nil
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM printers WHERE id = $1", id)
	return err
}
