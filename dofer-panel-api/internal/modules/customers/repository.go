package customers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// GetAll retrieves all customers with optional filters
func (r *Repository) GetAll(ctx context.Context, organizationID string, status, tier, segment string, limit, offset int) ([]Customer, error) {
	query := `SELECT * FROM customers WHERE organization_id = $1`
	args := []interface{}{organizationID}
	argNum := 2

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argNum)
		args = append(args, status)
		argNum++
	}

	if tier != "" {
		query += fmt.Sprintf(" AND customer_tier = $%d", argNum)
		args = append(args, tier)
		argNum++
	}

	if segment != "" {
		query += fmt.Sprintf(" AND marketing_segment = $%d", argNum)
		args = append(args, segment)
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

	customers, err := pgx.CollectRows(rows, pgx.RowToStructByName[Customer])
	return customers, err
}

// GetByID retrieves a customer by ID
func (r *Repository) GetByID(ctx context.Context, organizationID string, id uuid.UUID) (*Customer, error) {
	query := "SELECT * FROM customers WHERE id = $1 AND organization_id = $2"
	rows, err := r.db.Query(ctx, query, id, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customer, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Customer])
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &customer, err
}

// GetByEmail retrieves a customer by email
func (r *Repository) GetByEmail(ctx context.Context, organizationID string, email string) (*Customer, error) {
	query := "SELECT * FROM customers WHERE email = $1 AND organization_id = $2"
	rows, err := r.db.Query(ctx, query, email, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customer, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Customer])
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &customer, err
}

// Create creates a new customer
func (r *Repository) Create(ctx context.Context, organizationID string, req CreateCustomerRequest, userID uuid.UUID) (*Customer, error) {
	tagsJSON, _ := json.Marshal(req.Tags)
	materialsJSON, _ := json.Marshal(req.PreferredMaterials)

	query := `
		INSERT INTO customers (
			organization_id, name, email, phone, company, tax_id,
			address_line1, address_line2, city, state, postal_code, country,
			billing_name, billing_email, billing_address,
			preferred_payment_method, preferred_materials,
			internal_notes, tags, accepts_marketing, acquisition_source,
			created_by
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11, $12,
			$13, $14, $15,
			$16, $17,
			$18, $19, $20, $21,
			$22
		) RETURNING *
	`

	rows, err := r.db.Query(ctx, query,
		organizationID,
		req.Name, req.Email, req.Phone, req.Company, req.TaxID,
		req.AddressLine1, req.AddressLine2, req.City, req.State, req.PostalCode, req.Country,
		req.BillingName, req.BillingEmail, req.BillingAddress,
		req.PreferredPaymentMethod, materialsJSON,
		req.InternalNotes, tagsJSON, req.AcceptsMarketing, req.AcquisitionSource,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customer, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Customer])
	return &customer, err
}

// Update updates a customer
func (r *Repository) Update(ctx context.Context, organizationID string, id uuid.UUID, req UpdateCustomerRequest) (*Customer, error) {
	query := "UPDATE customers SET updated_at = CURRENT_TIMESTAMP"
	args := []interface{}{}
	argNum := 1

	if req.Name != nil {
		query += fmt.Sprintf(", name = $%d", argNum)
		args = append(args, *req.Name)
		argNum++
	}
	if req.DiscountPercentage != nil {
		query += fmt.Sprintf(", discount_percentage = $%d", argNum)
		args = append(args, *req.DiscountPercentage)
		argNum++
	}
	if req.InternalNotes != nil {
		query += fmt.Sprintf(", internal_notes = $%d", argNum)
		args = append(args, *req.InternalNotes)
		argNum++
	}
	if req.Tags != nil {
		tagsJSON, _ := json.Marshal(req.Tags)
		query += fmt.Sprintf(", tags = $%d", argNum)
		args = append(args, tagsJSON)
		argNum++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argNum)
	args = append(args, id)
	argNum++

	query += fmt.Sprintf(" AND organization_id = $%d RETURNING *", argNum)
	args = append(args, organizationID)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customer, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Customer])
	return &customer, err
}

// Delete deletes a customer
func (r *Repository) Delete(ctx context.Context, organizationID string, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM customers WHERE id = $1 AND organization_id = $2", id, organizationID)
	return err
}

// Search searches customers
func (r *Repository) Search(ctx context.Context, organizationID string, term string) ([]Customer, error) {
	query := `SELECT * FROM customers WHERE organization_id = $1 AND (name ILIKE $2 OR email ILIKE $2) ORDER BY name LIMIT 20`
	rows, err := r.db.Query(ctx, query, organizationID, "%"+term+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customers, err := pgx.CollectRows(rows, pgx.RowToStructByName[Customer])
	return customers, err
}

// GetAnalytics retrieves customer analytics
func (r *Repository) GetAnalytics(ctx context.Context, organizationID string, limit int) ([]CustomerAnalytics, error) {
	query := `
		SELECT
			c.id,
			c.name,
			c.email,
			COALESCE(c.customer_tier, 'regular') AS customer_tier,
			COUNT(o.id)::int AS total_orders,
			COALESCE(c.total_spent, 0)::float8 AS total_spent,
			CASE
				WHEN COUNT(o.id) > 0 THEN (COALESCE(c.total_spent, 0)::float8 / COUNT(o.id)::float8)
				ELSE COALESCE(c.average_order_value, 0)::float8
			END AS average_order_value,
			COALESCE(c.discount_percentage, 0)::float8 AS discount_percentage,
			c.last_order_date,
			c.created_at,
			COALESCE(c.status, 'active') AS status,
			COUNT(o.id) FILTER (WHERE o.created_at >= NOW() - INTERVAL '30 days')::int AS orders_last_30_days,
			0::float8 AS revenue_last_30_days,
			0::int AS interactions_last_30_days,
			CASE
				WHEN MAX(o.created_at) >= NOW() - INTERVAL '30 days' THEN 'active'
				WHEN MAX(o.created_at) >= NOW() - INTERVAL '90 days' THEN 'warm'
				ELSE 'inactive'
			END AS engagement_status
		FROM customers c
		LEFT JOIN orders o
			ON o.organization_id = c.organization_id
			AND o.customer_email IS NOT NULL
			AND LOWER(o.customer_email) = LOWER(c.email)
		WHERE c.organization_id = $1
		GROUP BY
			c.id, c.name, c.email, c.customer_tier, c.total_spent, c.average_order_value,
			c.discount_percentage, c.last_order_date, c.created_at, c.status
		ORDER BY total_spent DESC
		LIMIT $2
	`

	rows, err := r.db.Query(ctx, query, organizationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	analytics, err := pgx.CollectRows(rows, pgx.RowToStructByName[CustomerAnalytics])
	return analytics, err
}

// GetStats retrieves overall customer statistics
func (r *Repository) GetStats(ctx context.Context, organizationID string) (map[string]interface{}, error) {
	query := `
		SELECT
			COUNT(*) as total_customers,
			COUNT(*) FILTER (WHERE status = 'active') as active_customers,
			COUNT(*) FILTER (WHERE customer_tier = 'vip') as vip_customers,
			AVG(total_spent) as avg_lifetime_value,
			SUM(total_spent) as total_revenue
		FROM customers
		WHERE organization_id = $1
	`

	row := r.db.QueryRow(ctx, query, organizationID)

	var totalCustomers, activeCustomers, vipCustomers int
	var avgLifetimeValue, totalRevenue float64

	err := row.Scan(&totalCustomers, &activeCustomers, &vipCustomers, &avgLifetimeValue, &totalRevenue)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_customers":    totalCustomers,
		"active_customers":   activeCustomers,
		"vip_customers":      vipCustomers,
		"avg_lifetime_value": avgLifetimeValue,
		"total_revenue":      totalRevenue,
	}, nil
}

// GetInteractions retrieves customer interactions
func (r *Repository) GetInteractions(ctx context.Context, organizationID string, customerID uuid.UUID) ([]CustomerInteraction, error) {
	query := `
		SELECT ci.*
		FROM customer_interactions ci
		JOIN customers c ON c.id = ci.customer_id
		WHERE ci.customer_id = $1
		  AND c.organization_id = $2
		ORDER BY ci.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, customerID, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	interactions, err := pgx.CollectRows(rows, pgx.RowToStructByName[CustomerInteraction])
	return interactions, err
}

func (r *Repository) GetProfile360(ctx context.Context, organizationID string, customerID uuid.UUID) (*CustomerProfile360, error) {
	customer, err := r.GetByID(ctx, organizationID, customerID)
	if err != nil {
		return nil, err
	}
	if customer == nil {
		return nil, nil
	}

	profile := &CustomerProfile360{
		Customer: customer,
		Orders:   []Customer360Order{},
		Quotes:   []Customer360Quote{},
		Payments: []Customer360Payment{},
	}

	if customer.InternalNotes != nil {
		profile.Notes = *customer.InternalNotes
	}

	email := strings.TrimSpace(customer.Email)
	if email != "" {
		orders, err := r.getCustomerOrdersByEmail(ctx, organizationID, email, 25)
		if err != nil {
			return nil, err
		}
		profile.Orders = orders

		quotes, err := r.getCustomerQuotesByEmail(ctx, organizationID, email, 25)
		if err != nil {
			return nil, err
		}
		profile.Quotes = quotes

		payments, err := r.getCustomerPaymentsByEmail(ctx, organizationID, email, 40)
		if err != nil && !isUndefinedTableError(err) {
			return nil, err
		}
		if err == nil {
			profile.Payments = payments
		}
	}

	interactions, err := r.GetInteractions(ctx, organizationID, customerID)
	if err != nil && !isUndefinedTableError(err) {
		return nil, err
	}
	if err == nil {
		profile.Interactions = interactions
		if len(interactions) > 0 {
			first := interactions[0]
			profile.LastContact = &Customer360LastContact{
				InteractionType: first.InteractionType,
				Subject:         derefString(first.Subject),
				Description:     derefString(first.Description),
				CreatedAt:       first.CreatedAt,
				CreatedBy:       derefUUID(first.CreatedBy),
			}
		}
	}

	totalPaid := 0.0
	for _, payment := range profile.Payments {
		totalPaid += payment.Amount
	}

	outstanding := 0.0
	for _, order := range profile.Orders {
		if order.Status == "cancelled" {
			continue
		}
		outstanding += order.Balance
	}
	for _, quote := range profile.Quotes {
		if quote.Status == "rejected" || quote.Status == "expired" {
			continue
		}
		outstanding += quote.Balance
	}

	lastActivity := latestActivityTimestamp(profile)

	profile.Summary = Customer360Summary{
		TotalOrders:      maxInt(customer.TotalOrders, len(profile.Orders)),
		TotalQuotes:      len(profile.Quotes),
		TotalPayments:    len(profile.Payments),
		TotalPaid:        totalPaid,
		OutstandingTotal: outstanding,
		LastActivityAt:   lastActivity,
	}

	return profile, nil
}

func (r *Repository) getCustomerOrdersByEmail(ctx context.Context, organizationID string, email string, limit int) ([]Customer360Order, error) {
	query := `
		SELECT
			id::text,
			order_number,
			status,
			priority,
			product_name,
			COALESCE(amount, 0)::float8,
			COALESCE(amount_paid, 0)::float8,
			COALESCE(balance, 0)::float8,
			created_at,
			delivery_deadline
		FROM orders
		WHERE customer_email IS NOT NULL
		  AND organization_id = $1
		  AND LOWER(customer_email) = LOWER($2)
		ORDER BY created_at DESC
		LIMIT $3
	`

	rows, err := r.db.Query(ctx, query, organizationID, email, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := make([]Customer360Order, 0)
	for rows.Next() {
		var o Customer360Order
		var deliveryDeadline sql.NullTime
		if err := rows.Scan(
			&o.ID,
			&o.OrderNumber,
			&o.Status,
			&o.Priority,
			&o.ProductName,
			&o.Amount,
			&o.AmountPaid,
			&o.Balance,
			&o.CreatedAt,
			&deliveryDeadline,
		); err != nil {
			return nil, err
		}
		if deliveryDeadline.Valid {
			t := deliveryDeadline.Time
			o.DeliveryDeadline = &t
		}
		orders = append(orders, o)
	}

	return orders, rows.Err()
}

func (r *Repository) getCustomerQuotesByEmail(ctx context.Context, organizationID string, email string, limit int) ([]Customer360Quote, error) {
	query := `
		SELECT
			id::text,
			quote_number,
			status,
			COALESCE(total, 0)::float8,
			COALESCE(amount_paid, 0)::float8,
			COALESCE(balance, 0)::float8,
			valid_until,
			created_at,
			COALESCE(converted_to_order_id::text, '')
		FROM quotes
		WHERE customer_email IS NOT NULL
		  AND organization_id = $1
		  AND LOWER(customer_email) = LOWER($2)
		ORDER BY created_at DESC
		LIMIT $3
	`

	rows, err := r.db.Query(ctx, query, organizationID, email, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	quotes := make([]Customer360Quote, 0)
	for rows.Next() {
		var q Customer360Quote
		var validUntil sql.NullTime
		if err := rows.Scan(
			&q.ID,
			&q.QuoteNumber,
			&q.Status,
			&q.Total,
			&q.AmountPaid,
			&q.Balance,
			&validUntil,
			&q.CreatedAt,
			&q.ConvertedToOrderID,
		); err != nil {
			return nil, err
		}
		if validUntil.Valid {
			t := validUntil.Time
			q.ValidUntil = &t
		}
		quotes = append(quotes, q)
	}

	return quotes, rows.Err()
}

func (r *Repository) getCustomerPaymentsByEmail(ctx context.Context, organizationID string, email string, limit int) ([]Customer360Payment, error) {
	query := `
		SELECT
			p.id::text,
			p.source_type,
			p.source_id,
			p.source_number,
			p.amount::float8,
			COALESCE(p.payment_method, ''),
			p.payment_date,
			COALESCE(p.notes, ''),
			p.created_at
		FROM (
			SELECT
				op.id,
				'order'::text AS source_type,
				op.order_id::text AS source_id,
				o.order_number AS source_number,
				op.amount,
				op.payment_method,
				op.payment_date,
				op.notes,
				op.created_at
			FROM order_payments op
			JOIN orders o ON o.id = op.order_id
			WHERE o.customer_email IS NOT NULL
			  AND o.organization_id = $1
			  AND LOWER(o.customer_email) = LOWER($2)

			UNION ALL

			SELECT
				qp.id,
				'quote'::text AS source_type,
				qp.quote_id::text AS source_id,
				q.quote_number AS source_number,
				qp.amount,
				qp.payment_method,
				qp.payment_date,
				qp.notes,
				qp.created_at
			FROM quote_payments qp
			JOIN quotes q ON q.id = qp.quote_id
			WHERE q.customer_email IS NOT NULL
			  AND q.organization_id = $1
			  AND LOWER(q.customer_email) = LOWER($2)
		) p
		ORDER BY p.payment_date DESC
		LIMIT $3
	`

	rows, err := r.db.Query(ctx, query, organizationID, email, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	payments := make([]Customer360Payment, 0)
	for rows.Next() {
		var p Customer360Payment
		if err := rows.Scan(
			&p.ID,
			&p.SourceType,
			&p.SourceID,
			&p.SourceNumber,
			&p.Amount,
			&p.PaymentMethod,
			&p.PaymentDate,
			&p.Notes,
			&p.CreatedAt,
		); err != nil {
			return nil, err
		}
		payments = append(payments, p)
	}

	return payments, rows.Err()
}

func latestActivityTimestamp(profile *CustomerProfile360) *time.Time {
	if profile == nil {
		return nil
	}

	var latest *time.Time
	setLatest := func(candidate time.Time) {
		c := candidate
		if latest == nil || c.After(*latest) {
			latest = &c
		}
	}

	if profile.Customer != nil {
		setLatest(profile.Customer.UpdatedAt)
	}

	if profile.LastContact != nil {
		setLatest(profile.LastContact.CreatedAt)
	}

	if len(profile.Orders) > 0 {
		setLatest(profile.Orders[0].CreatedAt)
	}
	if len(profile.Quotes) > 0 {
		setLatest(profile.Quotes[0].CreatedAt)
	}
	if len(profile.Payments) > 0 {
		setLatest(profile.Payments[0].PaymentDate)
	}

	return latest
}

func isUndefinedTableError(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "42P01"
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func derefUUID(value *uuid.UUID) string {
	if value == nil {
		return ""
	}
	return value.String()
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// CreateInteraction creates a new interaction
func (r *Repository) CreateInteraction(ctx context.Context, organizationID string, customerID uuid.UUID, req CreateInteractionRequest, userID uuid.UUID) (*CustomerInteraction, error) {
	query := `
		INSERT INTO customer_interactions (
			customer_id, interaction_type, subject, description, priority, assigned_to, created_by
		)
		SELECT $1, $2, $3, $4, $5, $6, $7
		FROM customers
		WHERE id = $1 AND organization_id = $8
		RETURNING *
	`

	rows, err := r.db.Query(ctx, query,
		customerID, req.InteractionType, req.Subject, req.Description,
		req.Priority, req.AssignedTo, userID, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	interaction, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[CustomerInteraction])
	return &interaction, err
}
