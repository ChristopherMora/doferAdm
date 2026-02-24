package printers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

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

const (
	printerSelectColumns = "id, name, model, material, status, created_at, updated_at"
	defaultEstimateHours = 4.0
)

type Repository struct {
	db *pgxpool.Pool
}

type selectedPrinter struct {
	Printer
	ActiveJobs int
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

func scanPrinterRow(row pgx.Row) (*Printer, error) {
	var printer Printer
	var model, material sql.NullString

	err := row.Scan(
		&printer.ID,
		&printer.Name,
		&model,
		&material,
		&printer.Status,
		&printer.CreatedAt,
		&printer.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if model.Valid {
		printer.Model = &model.String
	}
	if material.Valid {
		printer.Material = &material.String
	}

	return &printer, nil
}

func scanSelectedPrinterRow(row pgx.Row) (*selectedPrinter, error) {
	printer, activeJobs, err := scanSelectedPrinterRaw(row)
	if err != nil {
		return nil, err
	}

	return &selectedPrinter{Printer: *printer, ActiveJobs: activeJobs}, nil
}

func scanSelectedPrinterRaw(row pgx.Row) (*Printer, int, error) {
	var printer Printer
	var model, material sql.NullString
	var activeJobs int

	err := row.Scan(
		&printer.ID,
		&printer.Name,
		&model,
		&material,
		&printer.Status,
		&printer.CreatedAt,
		&printer.UpdatedAt,
		&activeJobs,
	)
	if err != nil {
		return nil, 0, err
	}

	if model.Valid {
		printer.Model = &model.String
	}
	if material.Valid {
		printer.Material = &material.String
	}

	return &printer, activeJobs, nil
}

func materialSupported(printerMaterial *string, requested string) bool {
	requested = strings.TrimSpace(strings.ToUpper(requested))
	if requested == "" {
		return true
	}

	if printerMaterial == nil {
		return true
	}

	for _, part := range strings.Split(*printerMaterial, ",") {
		if strings.TrimSpace(strings.ToUpper(part)) == requested {
			return true
		}
	}

	return strings.Contains(strings.ToUpper(*printerMaterial), requested)
}

func (r *Repository) List(ctx context.Context, status string, limit, offset int) ([]PrinterWithQueue, error) {
	query := `
		SELECT p.id, p.name, p.model, p.material, p.status, p.created_at, p.updated_at,
		       current_job.order_id::text AS current_order_id,
		       current_job.assigned_at AS current_assigned_at,
		       COALESCE(active_jobs.active_count, 0) AS active_count
		FROM printers p
		LEFT JOIN LATERAL (
			SELECT pa.order_id, pa.assigned_at
			FROM printer_assignments pa
			WHERE pa.printer_id = p.id
			  AND pa.completed_at IS NULL
			ORDER BY pa.assigned_at ASC
			LIMIT 1
		) current_job ON true
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS active_count
			FROM printer_assignments pa
			WHERE pa.printer_id = p.id
			  AND pa.completed_at IS NULL
		) active_jobs ON true
		WHERE 1=1
	`

	args := []interface{}{}
	argNum := 1

	if strings.TrimSpace(status) != "" {
		normalizedStatus, err := normalizePrinterStatus(status)
		if err != nil {
			return nil, err
		}
		query += fmt.Sprintf(" AND p.status = $%d", argNum)
		args = append(args, normalizedStatus)
		argNum++
	}

	query += " ORDER BY p.created_at DESC"

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

	printers := make([]PrinterWithQueue, 0)
	for rows.Next() {
		var printer PrinterWithQueue
		var model, material, currentOrderID sql.NullString
		var currentAssignedAt sql.NullTime
		var activeCount int

		err := rows.Scan(
			&printer.ID,
			&printer.Name,
			&model,
			&material,
			&printer.Status,
			&printer.CreatedAt,
			&printer.UpdatedAt,
			&currentOrderID,
			&currentAssignedAt,
			&activeCount,
		)
		if err != nil {
			return nil, err
		}

		if model.Valid {
			printer.Model = &model.String
		}
		if material.Valid {
			printer.Material = &material.String
		}

		queueJobs := activeCount
		if currentOrderID.Valid && currentAssignedAt.Valid {
			estimatedCompletion := currentAssignedAt.Time.Add(time.Duration(defaultEstimateHours * float64(time.Hour)))
			printer.CurrentJob = &PrinterCurrentJob{
				OrderID:             currentOrderID.String,
				AssignedAt:          currentAssignedAt.Time,
				EstimatedCompletion: &estimatedCompletion,
			}
			if queueJobs > 0 {
				queueJobs--
			}
		}
		if queueJobs < 0 {
			queueJobs = 0
		}
		printer.QueueJobs = queueJobs

		printers = append(printers, printer)
	}

	return printers, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*Printer, error) {
	row := r.db.QueryRow(ctx, "SELECT "+printerSelectColumns+" FROM printers WHERE id = $1", id)
	printer, err := scanPrinterRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return printer, nil
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
		RETURNING id, name, model, material, status, created_at, updated_at
	`

	row := r.db.QueryRow(
		ctx,
		query,
		strings.TrimSpace(req.Name),
		sanitizeOptionalString(req.Model),
		sanitizeOptionalString(req.Material),
		status,
	)

	return scanPrinterRow(row)
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
		args = append(args, sanitizeOptionalString(req.Model))
		argNum++
	}

	if req.Material != nil {
		query += fmt.Sprintf(", material = $%d", argNum)
		args = append(args, sanitizeOptionalString(req.Material))
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

	query += fmt.Sprintf(" WHERE id = $%d RETURNING %s", argNum, printerSelectColumns)
	args = append(args, id)

	row := r.db.QueryRow(ctx, query, args...)
	printer, err := scanPrinterRow(row)
	if err != nil {
		return nil, err
	}

	return printer, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) (*Printer, error) {
	normalizedStatus, err := normalizePrinterStatus(status)
	if err != nil {
		return nil, err
	}

	row := r.db.QueryRow(
		ctx,
		"UPDATE printers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING "+printerSelectColumns,
		normalizedStatus,
		id,
	)
	printer, err := scanPrinterRow(row)
	if err != nil {
		return nil, err
	}

	return printer, nil
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM printers WHERE id = $1", id)
	return err
}

func (r *Repository) selectPreferredPrinter(ctx context.Context, tx pgx.Tx, preferredPrinterID, material string) (*selectedPrinter, error) {
	printerID, err := uuid.Parse(preferredPrinterID)
	if err != nil {
		return nil, ErrInvalidPrinterID
	}

	query := `
		SELECT p.id, p.name, p.model, p.material, p.status, p.created_at, p.updated_at,
		       COALESCE(active_jobs.active_count, 0) AS active_count
		FROM printers p
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS active_count
			FROM printer_assignments pa
			WHERE pa.printer_id = p.id
			  AND pa.completed_at IS NULL
		) active_jobs ON true
		WHERE p.id = $1
		FOR UPDATE
	`

	printer, err := scanSelectedPrinterRow(tx.QueryRow(ctx, query, printerID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPrinterNotFound
		}
		return nil, err
	}

	if printer.Status == "maintenance" || printer.Status == "offline" {
		return nil, ErrPrinterUnavailable
	}
	if !materialSupported(printer.Material, material) {
		return nil, ErrNoCompatiblePrinter
	}

	return printer, nil
}

func (r *Repository) selectAutoPrinter(ctx context.Context, tx pgx.Tx, material string) (*selectedPrinter, error) {
	availableQuery := `
		SELECT p.id, p.name, p.model, p.material, p.status, p.created_at, p.updated_at,
		       COALESCE(active_jobs.active_count, 0) AS active_count
		FROM printers p
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS active_count
			FROM printer_assignments pa
			WHERE pa.printer_id = p.id
			  AND pa.completed_at IS NULL
		) active_jobs ON true
		WHERE p.status = 'available'
		  AND ($1 = '' OR COALESCE(p.material, '') ILIKE ('%' || $1 || '%'))
		ORDER BY active_jobs.active_count ASC, p.created_at ASC
		LIMIT 1
		FOR UPDATE SKIP LOCKED
	`

	printer, err := scanSelectedPrinterRow(tx.QueryRow(ctx, availableQuery, material))
	if err == nil {
		return printer, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	busyQuery := `
		SELECT p.id, p.name, p.model, p.material, p.status, p.created_at, p.updated_at,
		       COALESCE(active_jobs.active_count, 0) AS active_count
		FROM printers p
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS active_count
			FROM printer_assignments pa
			WHERE pa.printer_id = p.id
			  AND pa.completed_at IS NULL
		) active_jobs ON true
		WHERE p.status = 'busy'
		  AND ($1 = '' OR COALESCE(p.material, '') ILIKE ('%' || $1 || '%'))
		ORDER BY active_jobs.active_count ASC, p.created_at ASC
		LIMIT 1
		FOR UPDATE SKIP LOCKED
	`

	printer, err = scanSelectedPrinterRow(tx.QueryRow(ctx, busyQuery, material))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoCompatiblePrinter
		}
		return nil, err
	}

	return printer, nil
}

func (r *Repository) AutoAssign(ctx context.Context, req AutoAssignRequest) (*AutoAssignResult, error) {
	orderID := strings.TrimSpace(req.OrderID)
	if orderID == "" {
		return nil, ErrInvalidOrderID
	}

	orderUUID, err := uuid.Parse(orderID)
	if err != nil {
		return nil, ErrInvalidOrderID
	}

	estimatedTimeHours := req.EstimatedTimeHours
	if estimatedTimeHours <= 0 {
		estimatedTimeHours = defaultEstimateHours
	}

	material := strings.TrimSpace(req.Material)
	preferredPrinterID := strings.TrimSpace(req.PrinterID)

	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var orderStatus string
	err = tx.QueryRow(ctx, "SELECT status FROM orders WHERE id = $1 FOR UPDATE", orderUUID).Scan(&orderStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrOrderNotFound
		}
		return nil, err
	}

	var activeAssignmentID string
	err = tx.QueryRow(ctx,
		"SELECT id::text FROM printer_assignments WHERE order_id = $1 AND completed_at IS NULL LIMIT 1",
		orderUUID,
	).Scan(&activeAssignmentID)
	if err == nil {
		return nil, ErrOrderAlreadyAssigned
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	var selected *selectedPrinter
	if preferredPrinterID != "" {
		selected, err = r.selectPreferredPrinter(ctx, tx, preferredPrinterID, material)
	} else {
		selected, err = r.selectAutoPrinter(ctx, tx, material)
	}
	if err != nil {
		return nil, err
	}

	queuePosition := selected.ActiveJobs
	assignedAt := time.Now().UTC()
	assignmentID := uuid.New()

	_, err = tx.Exec(ctx,
		"INSERT INTO printer_assignments (id, order_id, printer_id, assigned_at) VALUES ($1, $2, $3, $4)",
		assignmentID,
		orderUUID,
		selected.ID,
		assignedAt,
	)
	if err != nil {
		return nil, err
	}

	if selected.Status != "busy" {
		_, err = tx.Exec(ctx,
			"UPDATE printers SET status = 'busy', updated_at = NOW() WHERE id = $1",
			selected.ID,
		)
		if err != nil {
			return nil, err
		}
	}

	if orderStatus == "new" {
		_, err = tx.Exec(ctx,
			"UPDATE orders SET status = 'printing', updated_at = NOW() WHERE id = $1",
			orderUUID,
		)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	estimatedDuration := time.Duration(estimatedTimeHours * float64(time.Hour))
	estimatedStart := assignedAt.Add(time.Duration(queuePosition) * estimatedDuration)
	estimatedCompletion := estimatedStart.Add(estimatedDuration)

	return &AutoAssignResult{
		AssignmentID:        assignmentID.String(),
		OrderID:             orderUUID.String(),
		PrinterID:           selected.ID.String(),
		PrinterName:         selected.Name,
		QueuePosition:       queuePosition,
		EstimatedStart:      estimatedStart,
		EstimatedCompletion: estimatedCompletion,
	}, nil
}

func (r *Repository) CompleteAssignment(ctx context.Context, req CompleteAssignmentRequest) (*Printer, error) {
	orderID := strings.TrimSpace(req.OrderID)
	if orderID == "" {
		return nil, ErrInvalidOrderID
	}

	orderUUID, err := uuid.Parse(orderID)
	if err != nil {
		return nil, ErrInvalidOrderID
	}

	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var assignmentID uuid.UUID
	var printerID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT id, printer_id
		FROM printer_assignments
		WHERE order_id = $1
		  AND completed_at IS NULL
		ORDER BY assigned_at ASC
		LIMIT 1
		FOR UPDATE
	`, orderUUID).Scan(&assignmentID, &printerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAssignmentNotFound
		}
		return nil, err
	}

	_, err = tx.Exec(ctx,
		"UPDATE printer_assignments SET completed_at = NOW() WHERE id = $1",
		assignmentID,
	)
	if err != nil {
		return nil, err
	}

	var remainingActiveJobs int
	err = tx.QueryRow(ctx,
		"SELECT COUNT(*)::int FROM printer_assignments WHERE printer_id = $1 AND completed_at IS NULL",
		printerID,
	).Scan(&remainingActiveJobs)
	if err != nil {
		return nil, err
	}

	nextStatus := "busy"
	if remainingActiveJobs == 0 {
		nextStatus = "available"
	}

	row := tx.QueryRow(ctx,
		"UPDATE printers SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING "+printerSelectColumns,
		nextStatus,
		printerID,
	)
	printer, err := scanPrinterRow(row)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return printer, nil
}
