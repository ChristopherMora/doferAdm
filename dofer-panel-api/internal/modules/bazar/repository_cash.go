package bazar

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Repository) CloseDailyCut(
	ctx context.Context,
	organizationID string,
	bazarID, userID uuid.UUID,
	actorName string,
	businessDate, from, to time.Time,
	openingCash, closingCash float64,
	notes *string,
) (*DailyCut, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var bazarName, status string
	if err := tx.QueryRow(ctx, `
		SELECT name, status
		FROM bazaars
		WHERE id = $1 AND organization_id = $2
		FOR UPDATE
	`, bazarID, organizationID).Scan(&bazarName, &status); err != nil {
		if err == pgx.ErrNoRows {
			return nil, &serviceError{Status: http.StatusNotFound, Message: "Bazar no encontrado."}
		}
		return nil, err
	}
	if status != "active" {
		return nil, &serviceError{Status: http.StatusConflict, Message: "El bazar ya está cerrado."}
	}

	var existingID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT id
		FROM bazar_daily_cuts
		WHERE organization_id = $1 AND bazar_id = $2 AND business_date = $3
	`, organizationID, bazarID, businessDate).Scan(&existingID)
	if err == nil {
		return nil, &serviceError{Status: http.StatusConflict, Message: "El corte de este día ya fue registrado."}
	}
	if err != pgx.ErrNoRows {
		return nil, err
	}

	var cashSales float64
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(total), 0)
		FROM bazar_sales
		WHERE organization_id = $1
		  AND bazar_id = $2
		  AND status = 'completed'
		  AND payment_method = 'cash'
		  AND created_at >= $3
		  AND created_at < $4
	`, organizationID, bazarID, from, to).Scan(&cashSales); err != nil {
		return nil, err
	}

	expectedCash := openingCash + cashSales
	difference := closingCash - expectedCash
	row := tx.QueryRow(ctx, `
		INSERT INTO bazar_daily_cuts (
			organization_id, bazar_id, business_date, opening_cash, cash_sales,
			expected_cash, closing_cash, cash_difference, notes, closed_by, closed_by_name
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, bazar_id, business_date, opening_cash, cash_sales,
		          expected_cash, closing_cash, cash_difference, notes,
		          closed_by_name, closed_at
	`,
		organizationID,
		bazarID,
		businessDate,
		openingCash,
		cashSales,
		expectedCash,
		closingCash,
		difference,
		notes,
		userID,
		actorName,
	)
	cut, err := scanDailyCut(row)
	if err != nil {
		return nil, err
	}
	cut.BazarName = bazarName
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return cut, nil
}

func (r *Repository) ListDailyCuts(
	ctx context.Context,
	organizationID string,
	bazarID uuid.UUID,
	limit int,
) ([]DailyCut, error) {
	if limit <= 0 || limit > 365 {
		limit = 90
	}
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.bazar_id, b.name, c.business_date, c.opening_cash,
		       c.cash_sales, c.expected_cash, c.closing_cash, c.cash_difference,
		       c.notes, c.closed_by_name, c.closed_at
		FROM bazar_daily_cuts c
		JOIN bazaars b ON b.id = c.bazar_id
		WHERE c.organization_id = $1 AND c.bazar_id = $2
		ORDER BY c.business_date DESC
		LIMIT $3
	`, organizationID, bazarID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cuts := make([]DailyCut, 0)
	for rows.Next() {
		var cut DailyCut
		var businessDate time.Time
		var notes sql.NullString
		if err := rows.Scan(
			&cut.ID,
			&cut.BazarID,
			&cut.BazarName,
			&businessDate,
			&cut.OpeningCash,
			&cut.CashSales,
			&cut.ExpectedCash,
			&cut.ClosingCash,
			&cut.CashDifference,
			&notes,
			&cut.ClosedByName,
			&cut.ClosedAt,
		); err != nil {
			return nil, err
		}
		cut.BusinessDate = businessDate.Format("2006-01-02")
		if notes.Valid {
			cut.Notes = &notes.String
		}
		cuts = append(cuts, cut)
	}
	return cuts, rows.Err()
}

func scanDailyCut(row pgx.Row) (*DailyCut, error) {
	var cut DailyCut
	var businessDate time.Time
	var notes sql.NullString
	if err := row.Scan(
		&cut.ID,
		&cut.BazarID,
		&businessDate,
		&cut.OpeningCash,
		&cut.CashSales,
		&cut.ExpectedCash,
		&cut.ClosingCash,
		&cut.CashDifference,
		&notes,
		&cut.ClosedByName,
		&cut.ClosedAt,
	); err != nil {
		return nil, err
	}
	cut.BusinessDate = businessDate.Format("2006-01-02")
	if notes.Valid {
		cut.Notes = &notes.String
	}
	return &cut, nil
}
