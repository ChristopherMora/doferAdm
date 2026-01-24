package infra

import (
	"context"
	"database/sql"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
)

// AddPayment agrega un pago a una cotización
func (r *PostgresQuoteRepository) AddPayment(payment *domain.QuotePayment) error {
	query := `
		INSERT INTO quote_payments (
			id, quote_id, amount, payment_method, payment_date, notes, created_by, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.Exec(
		context.Background(),
		query,
		payment.ID,
		payment.QuoteID,
		payment.Amount,
		payment.PaymentMethod,
		payment.PaymentDate,
		payment.Notes,
		payment.CreatedBy,
		payment.CreatedAt,
	)

	return err
}

// GetPayments obtiene todos los pagos de una cotización
func (r *PostgresQuoteRepository) GetPayments(quoteID string) ([]*domain.QuotePayment, error) {
	query := `
		SELECT id, quote_id, amount, payment_method, payment_date, notes, created_by, created_at
		FROM quote_payments
		WHERE quote_id = $1
		ORDER BY payment_date DESC
	`

	rows, err := r.db.Query(context.Background(), query, quoteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []*domain.QuotePayment
	for rows.Next() {
		var payment domain.QuotePayment
		var paymentMethod, notes, createdBy sql.NullString

		err := rows.Scan(
			&payment.ID,
			&payment.QuoteID,
			&payment.Amount,
			&paymentMethod,
			&payment.PaymentDate,
			&notes,
			&createdBy,
			&payment.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if paymentMethod.Valid {
			payment.PaymentMethod = paymentMethod.String
		}
		if notes.Valid {
			payment.Notes = notes.String
		}
		if createdBy.Valid {
			payment.CreatedBy = createdBy.String
		}

		payments = append(payments, &payment)
	}

	return payments, rows.Err()
}
