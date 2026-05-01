package admin

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetOrganizationSummary(ctx context.Context, organizationID string) (*OrganizationSummary, error) {
	organizationID = strings.TrimSpace(organizationID)
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}

	var summary OrganizationSummary
	err := r.db.QueryRow(ctx, `
		SELECT
			o.id::text,
			o.name,
			o.slug,
			(SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) AS members,
			(SELECT COUNT(*) FROM orders WHERE organization_id = o.id) AS orders,
			(SELECT COUNT(*) FROM quotes WHERE organization_id = o.id) AS quotes,
			(SELECT COUNT(*) FROM customers WHERE organization_id = o.id) AS customers,
			(SELECT COUNT(*) FROM products WHERE organization_id = o.id) AS products,
			o.created_at,
			o.updated_at
		FROM organizations o
		WHERE o.id = $1
	`, organizationID).Scan(
		&summary.ID,
		&summary.Name,
		&summary.Slug,
		&summary.Members,
		&summary.Orders,
		&summary.Quotes,
		&summary.Customers,
		&summary.Products,
		&summary.CreatedAt,
		&summary.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("organization not found")
		}
		return nil, err
	}

	return &summary, nil
}

func (r *Repository) UpdateOrganization(ctx context.Context, organizationID string, request UpdateOrganizationRequest) (*OrganizationSummary, error) {
	organizationID = strings.TrimSpace(organizationID)
	name := strings.TrimSpace(request.Name)
	slug := normalizeSlug(request.Slug)
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}
	if name == "" {
		return nil, errors.New("organization name is required")
	}
	if slug == "" {
		slug = normalizeSlug(name)
	}
	if slug == "" {
		return nil, errors.New("organization slug is required")
	}

	_, err := r.db.Exec(ctx, `
		UPDATE organizations
		SET name = $2,
		    slug = $3,
		    updated_at = NOW()
		WHERE id = $1
	`, organizationID, name, slug)
	if err != nil {
		return nil, err
	}

	return r.GetOrganizationSummary(ctx, organizationID)
}

func (r *Repository) GetFinanceSummary(ctx context.Context, organizationID string) (*FinanceSummary, error) {
	organizationID = strings.TrimSpace(organizationID)
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}

	var summary FinanceSummary
	err := r.db.QueryRow(ctx, `
		WITH order_totals AS (
			SELECT
				COUNT(*) AS total_orders,
				COALESCE(SUM(amount), 0) AS order_value,
				COALESCE(SUM(amount_paid), 0) AS order_collected,
				COALESCE(SUM(GREATEST(balance, 0)), 0) AS order_pending,
				COALESCE(SUM(CASE WHEN delivery_deadline < NOW() AND balance > 0 THEN balance ELSE 0 END), 0) AS order_overdue
			FROM orders
			WHERE organization_id = $1
		),
		quote_totals AS (
			SELECT
				COUNT(*) AS total_quotes,
				COALESCE(SUM(total), 0) AS quote_value,
				COALESCE(SUM(amount_paid), 0) AS quote_collected,
				COALESCE(SUM(GREATEST(balance, 0)), 0) AS quote_pending,
				COALESCE(SUM(CASE WHEN valid_until < NOW() AND balance > 0 THEN balance ELSE 0 END), 0) AS quote_overdue
			FROM quotes
			WHERE organization_id = $1
		),
		payment_counts AS (
			SELECT
				(SELECT COUNT(*) FROM order_payments WHERE organization_id = $1) AS order_payments_count,
				(SELECT COUNT(*) FROM quote_payments WHERE organization_id = $1) AS quote_payments_count
		)
		SELECT
			ot.total_orders,
			qt.total_quotes,
			ot.order_value,
			qt.quote_value,
			ot.order_collected + qt.quote_collected AS collected,
			ot.order_pending + qt.quote_pending AS pending,
			ot.order_overdue + qt.quote_overdue AS overdue,
			pc.order_payments_count + pc.quote_payments_count AS payments_count,
			pc.order_payments_count,
			pc.quote_payments_count
		FROM order_totals ot, quote_totals qt, payment_counts pc
	`, organizationID).Scan(
		&summary.TotalOrders,
		&summary.TotalQuotes,
		&summary.OrderValue,
		&summary.QuoteValue,
		&summary.Collected,
		&summary.Pending,
		&summary.Overdue,
		&summary.PaymentsCount,
		&summary.OrderPaymentsCount,
		&summary.QuotePaymentsCount,
	)
	if err != nil {
		return nil, err
	}

	totalValue := summary.OrderValue + summary.QuoteValue
	if totalValue > 0 {
		summary.CollectionRate = (summary.Collected / totalValue) * 100
	}

	return &summary, nil
}

func (r *Repository) ListFinancePayments(ctx context.Context, organizationID string, limit int) ([]FinancePayment, error) {
	organizationID = strings.TrimSpace(organizationID)
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	rows, err := r.db.Query(ctx, `
		SELECT *
		FROM (
			SELECT
				op.id::text,
				'order' AS source_type,
				o.id::text AS source_id,
				o.order_number AS reference,
				o.customer_name,
				op.amount,
				COALESCE(op.payment_method, '') AS payment_method,
				op.payment_date,
				COALESCE(op.notes, '') AS notes,
				COALESCE(op.created_by, '') AS created_by,
				op.created_at
			FROM order_payments op
			INNER JOIN orders o ON o.id = op.order_id AND o.organization_id = op.organization_id
			WHERE op.organization_id = $1
			UNION ALL
			SELECT
				qp.id::text,
				'quote' AS source_type,
				q.id::text AS source_id,
				q.quote_number AS reference,
				q.customer_name,
				qp.amount,
				COALESCE(qp.payment_method, '') AS payment_method,
				qp.payment_date,
				COALESCE(qp.notes, '') AS notes,
				COALESCE(qp.created_by, '') AS created_by,
				qp.created_at
			FROM quote_payments qp
			INNER JOIN quotes q ON q.id = qp.quote_id AND q.organization_id = qp.organization_id
			WHERE qp.organization_id = $1
		) payments
		ORDER BY payment_date DESC, created_at DESC
		LIMIT $2
	`, organizationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	payments := make([]FinancePayment, 0)
	for rows.Next() {
		var payment FinancePayment
		var paymentMethod, notes, createdBy sql.NullString
		if err := rows.Scan(
			&payment.ID,
			&payment.SourceType,
			&payment.SourceID,
			&payment.Reference,
			&payment.CustomerName,
			&payment.Amount,
			&paymentMethod,
			&payment.PaymentDate,
			&notes,
			&createdBy,
			&payment.CreatedAt,
		); err != nil {
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
		payments = append(payments, payment)
	}

	return payments, rows.Err()
}

func normalizeSlug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	return value
}
