package infra

import (
	"context"
	"database/sql"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

// AddPayment agrega un pago a una orden
func (r *PostgresOrderRepository) AddPayment(payment *domain.OrderPayment) error {
	query := `
		INSERT INTO order_payments (
			id, organization_id, order_id, amount, payment_method, payment_date, notes, created_by, created_at
		)
		SELECT $1, organization_id, $2, $3, $4, $5, $6, $7, $8
		FROM orders
		WHERE id = $2 AND organization_id = $9
	`

	_, err := r.db.Exec(
		context.Background(),
		query,
		payment.ID,
		payment.OrderID,
		payment.Amount,
		payment.PaymentMethod,
		payment.PaymentDate,
		payment.Notes,
		payment.CreatedBy,
		payment.CreatedAt,
		payment.OrganizationID,
	)

	return err
}

// GetPayments obtiene todos los pagos de una orden
func (r *PostgresOrderRepository) GetPayments(orderID, organizationID string) ([]*domain.OrderPayment, error) {
	query := `
		SELECT id, organization_id, order_id, amount, payment_method, payment_date, notes, created_by, created_at
		FROM order_payments
		WHERE order_id = $1 AND organization_id = $2
		ORDER BY payment_date DESC
	`

	rows, err := r.db.Query(context.Background(), query, orderID, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []*domain.OrderPayment
	for rows.Next() {
		var payment domain.OrderPayment
		var paymentMethod, notes, createdBy sql.NullString

		err := rows.Scan(
			&payment.ID,
			&payment.OrganizationID,
			&payment.OrderID,
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

	return payments, nil
}

// GetPaymentByID obtiene un pago por su ID
func (r *PostgresOrderRepository) GetPaymentByID(paymentID, organizationID string) (*domain.OrderPayment, error) {
	query := `
		SELECT id, organization_id, order_id, amount, payment_method, payment_date, notes, created_by, created_at
		FROM order_payments
		WHERE id = $1 AND organization_id = $2
	`

	var payment domain.OrderPayment
	var paymentMethod, notes, createdBy sql.NullString

	err := r.db.QueryRow(context.Background(), query, paymentID, organizationID).Scan(
		&payment.ID,
		&payment.OrganizationID,
		&payment.OrderID,
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

	return &payment, nil
}

// DeletePayment elimina un pago
func (r *PostgresOrderRepository) DeletePayment(paymentID, organizationID string) error {
	query := `DELETE FROM order_payments WHERE id = $1 AND organization_id = $2`
	_, err := r.db.Exec(context.Background(), query, paymentID, organizationID)
	return err
}

// UpdateOrderPaymentTotals actualiza los totales de pago de una orden
func (r *PostgresOrderRepository) UpdateOrderPaymentTotals(orderID, organizationID string, amountPaid float64, balance float64) error {
	query := `
		UPDATE orders
		SET amount_paid = $1, balance = $2, updated_at = NOW()
		WHERE id = $3 AND organization_id = $4
	`

	_, err := r.db.Exec(context.Background(), query, amountPaid, balance, orderID, organizationID)
	return err
}
