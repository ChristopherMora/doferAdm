package admin

import (
	"context"
	"database/sql"
	"encoding/json"
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

func (r *Repository) ListOrganizationsForUser(ctx context.Context, userID string) ([]OrganizationSummary, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, errors.New("user ID is required")
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			o.id::text,
			o.name,
			o.slug,
			(SELECT COUNT(*) FROM organization_members om2 WHERE om2.organization_id = o.id) AS members,
			(SELECT COUNT(*) FROM orders WHERE organization_id = o.id) AS orders,
			(SELECT COUNT(*) FROM quotes WHERE organization_id = o.id) AS quotes,
			(SELECT COUNT(*) FROM customers WHERE organization_id = o.id) AS customers,
			(SELECT COUNT(*) FROM products WHERE organization_id = o.id) AS products,
			o.created_at,
			o.updated_at
		FROM organizations o
		INNER JOIN organization_members om ON om.organization_id = o.id
		WHERE om.user_id = $1
		ORDER BY o.created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	organizations := make([]OrganizationSummary, 0)
	for rows.Next() {
		var organization OrganizationSummary
		if err := rows.Scan(
			&organization.ID,
			&organization.Name,
			&organization.Slug,
			&organization.Members,
			&organization.Orders,
			&organization.Quotes,
			&organization.Customers,
			&organization.Products,
			&organization.CreatedAt,
			&organization.UpdatedAt,
		); err != nil {
			return nil, err
		}
		organizations = append(organizations, organization)
	}

	return organizations, rows.Err()
}

func (r *Repository) CreateAuditLog(ctx context.Context, organizationID, actorUserID, action, entityType, entityID string, metadata map[string]interface{}) error {
	organizationID = strings.TrimSpace(organizationID)
	actorUserID = strings.TrimSpace(actorUserID)
	action = strings.TrimSpace(action)
	entityType = strings.TrimSpace(entityType)
	entityID = strings.TrimSpace(entityID)
	if organizationID == "" || action == "" || entityType == "" {
		return errors.New("audit log requires organization, action and entity type")
	}
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	var actor interface{}
	if isUUID(actorUserID) {
		actor = actorUserID
	}

	_, err = r.db.Exec(ctx, `
		INSERT INTO organization_audit_logs (
			organization_id, actor_user_id, action, entity_type, entity_id, metadata
		) VALUES ($1, $2, $3, $4, $5, $6)
	`, organizationID, actor, action, entityType, entityID, metadataJSON)
	return err
}

func (r *Repository) ListAuditLogs(ctx context.Context, organizationID string, limit int) ([]AuditLog, error) {
	organizationID = strings.TrimSpace(organizationID)
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			al.id::text,
			COALESCE(al.actor_user_id::text, ''),
			COALESCE(u.email, ''),
			al.action,
			al.entity_type,
			COALESCE(al.entity_id, ''),
			al.metadata,
			al.created_at
		FROM organization_audit_logs al
		LEFT JOIN users u ON u.id = al.actor_user_id
		WHERE al.organization_id = $1
		ORDER BY al.created_at DESC
		LIMIT $2
	`, organizationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := make([]AuditLog, 0)
	for rows.Next() {
		var log AuditLog
		var metadataJSON []byte
		if err := rows.Scan(
			&log.ID,
			&log.ActorUserID,
			&log.ActorEmail,
			&log.Action,
			&log.EntityType,
			&log.EntityID,
			&metadataJSON,
			&log.CreatedAt,
		); err != nil {
			return nil, err
		}
		if len(metadataJSON) > 0 {
			_ = json.Unmarshal(metadataJSON, &log.Metadata)
		}
		if log.Metadata == nil {
			log.Metadata = map[string]interface{}{}
		}
		logs = append(logs, log)
	}

	return logs, rows.Err()
}

func (r *Repository) ListUserMetrics(ctx context.Context, organizationID string) ([]UserMetric, error) {
	organizationID = strings.TrimSpace(organizationID)
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}

	rows, err := r.db.Query(ctx, `
		WITH order_metrics AS (
			SELECT
				assigned_to AS user_id,
				COUNT(*) AS assigned_orders,
				COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_orders,
				COUNT(*) FILTER (WHERE status NOT IN ('delivered', 'cancelled')) AS active_orders
			FROM orders
			WHERE organization_id = $1
			  AND assigned_to IS NOT NULL
			GROUP BY assigned_to
		),
		time_metrics AS (
			SELECT
				operator_id AS user_id,
				COALESCE(SUM(duration_minutes), 0) AS total_minutes,
				COALESCE(AVG(NULLIF(duration_minutes, 0)), 0) AS average_minutes
			FROM order_time_entries
			WHERE organization_id = $1
			GROUP BY operator_id
		)
		SELECT
			u.id::text,
			u.email,
			COALESCE(NULLIF(u.full_name, ''), u.email) AS full_name,
			om.role,
			COALESCE(order_metrics.assigned_orders, 0) AS assigned_orders,
			COALESCE(order_metrics.delivered_orders, 0) AS delivered_orders,
			COALESCE(order_metrics.active_orders, 0) AS active_orders,
			COALESCE(time_metrics.total_minutes, 0) AS total_minutes,
			COALESCE(time_metrics.average_minutes, 0) AS average_minutes
		FROM organization_members om
		INNER JOIN users u ON u.id = om.user_id
		LEFT JOIN order_metrics ON order_metrics.user_id = u.id
		LEFT JOIN time_metrics ON time_metrics.user_id = u.id
		WHERE om.organization_id = $1
		ORDER BY delivered_orders DESC, assigned_orders DESC, lower(u.email)
	`, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	metrics := make([]UserMetric, 0)
	for rows.Next() {
		var metric UserMetric
		if err := rows.Scan(
			&metric.UserID,
			&metric.Email,
			&metric.FullName,
			&metric.Role,
			&metric.AssignedOrders,
			&metric.DeliveredOrders,
			&metric.ActiveOrders,
			&metric.TotalMinutes,
			&metric.AverageMinutes,
		); err != nil {
			return nil, err
		}
		metrics = append(metrics, metric)
	}

	return metrics, rows.Err()
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

func (r *Repository) ListReceivables(ctx context.Context, organizationID, status string, limit int) ([]Receivable, error) {
	organizationID = strings.TrimSpace(organizationID)
	status = strings.ToLower(strings.TrimSpace(status))
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	rows, err := r.db.Query(ctx, `
		WITH receivables AS (
			SELECT
				id::text,
				'order' AS type,
				order_number AS reference,
				customer_name,
				amount AS total,
				amount_paid,
				balance,
				delivery_deadline AS due_date,
				CASE
					WHEN balance <= 0 THEN 'paid'
					WHEN delivery_deadline IS NOT NULL AND delivery_deadline < NOW() THEN 'overdue'
					WHEN amount_paid > 0 THEN 'partial'
					ELSE 'pending'
				END AS status
			FROM orders
			WHERE organization_id = $1 AND balance > 0
			UNION ALL
			SELECT
				id::text,
				'quote' AS type,
				quote_number AS reference,
				customer_name,
				total,
				amount_paid,
				balance,
				valid_until AS due_date,
				CASE
					WHEN balance <= 0 THEN 'paid'
					WHEN valid_until IS NOT NULL AND valid_until < NOW() THEN 'overdue'
					WHEN amount_paid > 0 THEN 'partial'
					ELSE 'pending'
				END AS status
			FROM quotes
			WHERE organization_id = $1 AND balance > 0
		)
		SELECT
			id,
			type,
			reference,
			customer_name,
			total,
			amount_paid,
			balance,
			due_date,
			status,
			CASE
				WHEN due_date IS NOT NULL AND due_date < NOW()
				THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400)::int
				ELSE 0
			END AS days_overdue
		FROM receivables
		WHERE ($2 = '' OR status = $2)
		ORDER BY
			CASE WHEN status = 'overdue' THEN 1 WHEN status = 'partial' THEN 2 ELSE 3 END,
			due_date ASC NULLS LAST,
			balance DESC
		LIMIT $3
	`, organizationID, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	receivables := make([]Receivable, 0)
	for rows.Next() {
		var receivable Receivable
		var dueDate sql.NullTime
		if err := rows.Scan(
			&receivable.ID,
			&receivable.Type,
			&receivable.Reference,
			&receivable.CustomerName,
			&receivable.Total,
			&receivable.AmountPaid,
			&receivable.Balance,
			&dueDate,
			&receivable.Status,
			&receivable.DaysOverdue,
		); err != nil {
			return nil, err
		}
		if dueDate.Valid {
			receivable.DueDate = &dueDate.Time
		}
		receivables = append(receivables, receivable)
	}

	return receivables, rows.Err()
}

func (r *Repository) ListFinanceCuts(ctx context.Context, organizationID, period string, limit int) ([]FinanceCut, error) {
	organizationID = strings.TrimSpace(organizationID)
	period = strings.ToLower(strings.TrimSpace(period))
	if organizationID == "" {
		return nil, errors.New("organization ID is required")
	}
	switch period {
	case "day", "week", "month":
	default:
		period = "week"
	}
	if limit <= 0 || limit > 100 {
		limit = 12
	}

	rows, err := r.db.Query(ctx, `
		WITH payments AS (
			SELECT payment_date, amount, 'order' AS source_type
			FROM order_payments
			WHERE organization_id = $1
			UNION ALL
			SELECT payment_date, amount, 'quote' AS source_type
			FROM quote_payments
			WHERE organization_id = $1
		)
		SELECT
			date_trunc($2, payment_date)::timestamptz AS period_start,
			COALESCE(SUM(amount) FILTER (WHERE source_type = 'order'), 0) AS order_payments,
			COALESCE(SUM(amount) FILTER (WHERE source_type = 'quote'), 0) AS quote_payments,
			COALESCE(SUM(amount), 0) AS total_collected,
			COUNT(*) AS payments_count
		FROM payments
		GROUP BY date_trunc($2, payment_date)
		ORDER BY period_start DESC
		LIMIT $3
	`, organizationID, period, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cuts := make([]FinanceCut, 0)
	for rows.Next() {
		var cut FinanceCut
		cut.Period = period
		if err := rows.Scan(
			&cut.PeriodStart,
			&cut.OrderPayments,
			&cut.QuotePayments,
			&cut.TotalCollected,
			&cut.PaymentsCount,
		); err != nil {
			return nil, err
		}
		cuts = append(cuts, cut)
	}

	return cuts, rows.Err()
}

func normalizeSlug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	return value
}

func isUUID(value string) bool {
	return regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`).MatchString(value)
}
