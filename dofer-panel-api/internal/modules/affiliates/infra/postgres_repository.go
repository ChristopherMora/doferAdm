package infra

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresAffiliateRepository struct {
	db *pgxpool.Pool
}

func NewPostgresAffiliateRepository(db *pgxpool.Pool) *PostgresAffiliateRepository {
	return &PostgresAffiliateRepository{db: db}
}

const affiliateColumns = `
	id, user_id, display_name, email, phone, commission_type, commission_value,
	status, notes, created_by, created_at, updated_at
`

func scanAffiliate(row pgx.Row) (*domain.Affiliate, error) {
	var a domain.Affiliate
	var phone, notes, createdBy sql.NullString

	err := row.Scan(
		&a.ID, &a.UserID, &a.DisplayName, &a.Email, &phone,
		&a.CommissionType, &a.CommissionValue, &a.Status, &notes, &createdBy,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if phone.Valid {
		a.Phone = phone.String
	}
	if notes.Valid {
		a.Notes = notes.String
	}
	if createdBy.Valid {
		a.CreatedBy = createdBy.String
	}

	return &a, nil
}

func (r *PostgresAffiliateRepository) CreateAffiliate(a *domain.Affiliate) error {
	query := `
		INSERT INTO affiliates (
			id, user_id, display_name, email, phone, commission_type,
			commission_value, status, notes, created_by
		) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`

	var createdBy interface{}
	if a.CreatedBy != "" {
		createdBy = a.CreatedBy
	}

	return r.db.QueryRow(context.Background(), query,
		a.UserID, a.DisplayName, a.Email, a.Phone, a.CommissionType,
		a.CommissionValue, a.Status, a.Notes, createdBy,
	).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
}

func (r *PostgresAffiliateRepository) FindAffiliateByID(id string) (*domain.Affiliate, error) {
	query := `SELECT ` + affiliateColumns + ` FROM affiliates WHERE id = $1`
	a, err := scanAffiliate(r.db.QueryRow(context.Background(), query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("affiliate not found")
		}
		return nil, err
	}
	return a, nil
}

func (r *PostgresAffiliateRepository) FindAffiliateByUserID(userID string) (*domain.Affiliate, error) {
	query := `SELECT ` + affiliateColumns + ` FROM affiliates WHERE user_id = $1`
	a, err := scanAffiliate(r.db.QueryRow(context.Background(), query, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("affiliate not found")
		}
		return nil, err
	}
	return a, nil
}

func (r *PostgresAffiliateRepository) ListAffiliates(filters domain.AffiliateFilters) ([]*domain.Affiliate, error) {
	query := `SELECT ` + affiliateColumns + ` FROM affiliates WHERE 1=1`
	args := []interface{}{}
	argPos := 1

	if filters.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, filters.Status)
		argPos++
	}

	query += " ORDER BY created_at DESC"

	rows, err := r.db.Query(context.Background(), query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	affiliates := []*domain.Affiliate{}
	for rows.Next() {
		a, err := scanAffiliate(rows)
		if err != nil {
			return nil, err
		}
		affiliates = append(affiliates, a)
	}
	return affiliates, nil
}

func (r *PostgresAffiliateRepository) UpdateAffiliate(a *domain.Affiliate) error {
	query := `
		UPDATE affiliates SET
			display_name = $2, phone = $3, commission_type = $4,
			commission_value = $5, status = $6, notes = $7, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(context.Background(), query,
		a.ID, a.DisplayName, a.Phone, a.CommissionType, a.CommissionValue, a.Status, a.Notes,
	)
	return err
}

// CreateAffiliateUser inserta directamente la fila en `users` con role='affiliate'.
// A propósito NO reusa auth.UpsertUser (que hardcodea role='operator'): esta fila
// debe existir con el rol correcto ANTES del primer login del afiliado, para que
// el ON CONFLICT DO NOTHING de SyncUser no la pise.
func (r *PostgresAffiliateRepository) CreateAffiliateUser(id, email, fullName string) error {
	query := `
		INSERT INTO users (id, email, full_name, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'affiliate', NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`
	_, err := r.db.Exec(context.Background(), query, id, email, fullName)
	return err
}

const orderRequestColumns = `
	id, affiliate_id, product_id, product_name, quantity, suggested_price_snapshot,
	final_price, customer_name, customer_email, customer_phone, customer_notes,
	status, rejection_reason, reviewed_by, reviewed_at, order_id, created_at, updated_at
`

func scanOrderRequest(row pgx.Row) (*domain.AffiliateOrderRequest, error) {
	var req domain.AffiliateOrderRequest
	var productID, customerEmail, customerPhone, customerNotes, rejectionReason, reviewedBy, orderID sql.NullString
	var suggestedPriceSnapshot sql.NullFloat64
	var reviewedAt sql.NullTime

	err := row.Scan(
		&req.ID, &req.AffiliateID, &productID, &req.ProductName, &req.Quantity, &suggestedPriceSnapshot,
		&req.FinalPrice, &req.CustomerName, &customerEmail, &customerPhone, &customerNotes,
		&req.Status, &rejectionReason, &reviewedBy, &reviewedAt, &orderID, &req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if productID.Valid {
		req.ProductID = productID.String
	}
	if suggestedPriceSnapshot.Valid {
		req.SuggestedPriceSnapshot = suggestedPriceSnapshot.Float64
	}
	if customerEmail.Valid {
		req.CustomerEmail = customerEmail.String
	}
	if customerPhone.Valid {
		req.CustomerPhone = customerPhone.String
	}
	if customerNotes.Valid {
		req.CustomerNotes = customerNotes.String
	}
	if rejectionReason.Valid {
		req.RejectionReason = rejectionReason.String
	}
	if reviewedBy.Valid {
		req.ReviewedBy = reviewedBy.String
	}
	if reviewedAt.Valid {
		t := reviewedAt.Time
		req.ReviewedAt = &t
	}
	if orderID.Valid {
		req.OrderID = orderID.String
	}

	return &req, nil
}

func (r *PostgresAffiliateRepository) CreateOrderRequest(req *domain.AffiliateOrderRequest) error {
	query := `
		INSERT INTO affiliate_order_requests (
			id, affiliate_id, product_id, product_name, quantity, suggested_price_snapshot,
			final_price, customer_name, customer_email, customer_phone, customer_notes, status
		) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at
	`

	var productID interface{}
	if req.ProductID != "" {
		productID = req.ProductID
	}

	return r.db.QueryRow(context.Background(), query,
		req.AffiliateID, productID, req.ProductName, req.Quantity, req.SuggestedPriceSnapshot,
		req.FinalPrice, req.CustomerName, req.CustomerEmail, req.CustomerPhone, req.CustomerNotes, req.Status,
	).Scan(&req.ID, &req.CreatedAt, &req.UpdatedAt)
}

func (r *PostgresAffiliateRepository) FindOrderRequestByID(id string) (*domain.AffiliateOrderRequest, error) {
	query := `SELECT ` + orderRequestColumns + ` FROM affiliate_order_requests WHERE id = $1`
	req, err := scanOrderRequest(r.db.QueryRow(context.Background(), query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("affiliate order request not found")
		}
		return nil, err
	}
	return req, nil
}

// ListOrderRequests incluye el status de la orden real vinculada (cuando existe)
// vía LEFT JOIN, para que el portal de afiliado no necesite un segundo fetch.
func (r *PostgresAffiliateRepository) ListOrderRequests(filters domain.OrderRequestFilters) ([]*domain.AffiliateOrderRequest, error) {
	query := `
		SELECT ` + prefixedOrderRequestColumns() + `, COALESCE(o.status, '')
		FROM affiliate_order_requests req
		LEFT JOIN orders o ON o.id = req.order_id
		WHERE 1=1
	`
	args := []interface{}{}
	argPos := 1

	if filters.AffiliateID != "" {
		query += fmt.Sprintf(" AND req.affiliate_id = $%d", argPos)
		args = append(args, filters.AffiliateID)
		argPos++
	}

	if filters.Status != "" {
		query += fmt.Sprintf(" AND req.status = $%d", argPos)
		args = append(args, filters.Status)
		argPos++
	}

	query += " ORDER BY req.created_at DESC"

	rows, err := r.db.Query(context.Background(), query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	requests := []*domain.AffiliateOrderRequest{}
	for rows.Next() {
		req, orderStatus, err := scanOrderRequestWithOrderStatus(rows)
		if err != nil {
			return nil, err
		}
		req.OrderStatus = orderStatus
		requests = append(requests, req)
	}
	return requests, nil
}

// prefixedOrderRequestColumns devuelve las columnas de affiliate_order_requests
// calificadas con el alias "req." para usarlas en queries con JOIN.
func prefixedOrderRequestColumns() string {
	return `req.id, req.affiliate_id, req.product_id, req.product_name, req.quantity,
		req.suggested_price_snapshot, req.final_price, req.customer_name, req.customer_email,
		req.customer_phone, req.customer_notes, req.status, req.rejection_reason,
		req.reviewed_by, req.reviewed_at, req.order_id, req.created_at, req.updated_at`
}

func scanOrderRequestWithOrderStatus(rows pgx.Rows) (*domain.AffiliateOrderRequest, string, error) {
	var req domain.AffiliateOrderRequest
	var productID, customerEmail, customerPhone, customerNotes, rejectionReason, reviewedBy, orderID sql.NullString
	var suggestedPriceSnapshot sql.NullFloat64
	var reviewedAt sql.NullTime
	var orderStatus string

	err := rows.Scan(
		&req.ID, &req.AffiliateID, &productID, &req.ProductName, &req.Quantity, &suggestedPriceSnapshot,
		&req.FinalPrice, &req.CustomerName, &customerEmail, &customerPhone, &customerNotes,
		&req.Status, &rejectionReason, &reviewedBy, &reviewedAt, &orderID, &req.CreatedAt, &req.UpdatedAt,
		&orderStatus,
	)
	if err != nil {
		return nil, "", err
	}

	if productID.Valid {
		req.ProductID = productID.String
	}
	if suggestedPriceSnapshot.Valid {
		req.SuggestedPriceSnapshot = suggestedPriceSnapshot.Float64
	}
	if customerEmail.Valid {
		req.CustomerEmail = customerEmail.String
	}
	if customerPhone.Valid {
		req.CustomerPhone = customerPhone.String
	}
	if customerNotes.Valid {
		req.CustomerNotes = customerNotes.String
	}
	if rejectionReason.Valid {
		req.RejectionReason = rejectionReason.String
	}
	if reviewedBy.Valid {
		req.ReviewedBy = reviewedBy.String
	}
	if reviewedAt.Valid {
		t := reviewedAt.Time
		req.ReviewedAt = &t
	}
	if orderID.Valid {
		req.OrderID = orderID.String
	}

	return &req, orderStatus, nil
}

func (r *PostgresAffiliateRepository) UpdateOrderRequest(req *domain.AffiliateOrderRequest) error {
	query := `
		UPDATE affiliate_order_requests SET
			status = $2, rejection_reason = $3, reviewed_by = $4, reviewed_at = $5,
			order_id = $6, updated_at = NOW()
		WHERE id = $1
	`

	var reviewedBy, orderID, rejectionReason interface{}
	if req.ReviewedBy != "" {
		reviewedBy = req.ReviewedBy
	}
	if req.OrderID != "" {
		orderID = req.OrderID
	}
	if req.RejectionReason != "" {
		rejectionReason = req.RejectionReason
	}

	_, err := r.db.Exec(context.Background(), query,
		req.ID, req.Status, rejectionReason, reviewedBy, req.ReviewedAt, orderID,
	)
	return err
}

const commissionColumns = `
	id, affiliate_id, affiliate_order_request_id, order_id, commission_amount,
	status, paid_at, paid_by, payment_notes, created_at, updated_at
`

func scanCommission(row pgx.Row) (*domain.AffiliateCommission, error) {
	var c domain.AffiliateCommission
	var paidBy, paymentNotes sql.NullString
	var paidAt sql.NullTime

	err := row.Scan(
		&c.ID, &c.AffiliateID, &c.AffiliateOrderRequestID, &c.OrderID, &c.CommissionAmount,
		&c.Status, &paidAt, &paidBy, &paymentNotes, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if paidAt.Valid {
		t := paidAt.Time
		c.PaidAt = &t
	}
	if paidBy.Valid {
		c.PaidBy = paidBy.String
	}
	if paymentNotes.Valid {
		c.PaymentNotes = paymentNotes.String
	}

	return &c, nil
}

func (r *PostgresAffiliateRepository) CreateCommission(c *domain.AffiliateCommission) error {
	query := `
		INSERT INTO affiliate_commissions (
			id, affiliate_id, affiliate_order_request_id, order_id, commission_amount, status
		) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(context.Background(), query,
		c.AffiliateID, c.AffiliateOrderRequestID, c.OrderID, c.CommissionAmount, c.Status,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *PostgresAffiliateRepository) FindCommissionByID(id string) (*domain.AffiliateCommission, error) {
	query := `SELECT ` + commissionColumns + ` FROM affiliate_commissions WHERE id = $1`
	c, err := scanCommission(r.db.QueryRow(context.Background(), query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("affiliate commission not found")
		}
		return nil, err
	}
	return c, nil
}

func (r *PostgresAffiliateRepository) ListCommissions(filters domain.CommissionFilters) ([]*domain.AffiliateCommission, error) {
	query := `SELECT ` + commissionColumns + ` FROM affiliate_commissions WHERE 1=1`
	args := []interface{}{}
	argPos := 1

	if filters.AffiliateID != "" {
		query += fmt.Sprintf(" AND affiliate_id = $%d", argPos)
		args = append(args, filters.AffiliateID)
		argPos++
	}

	if filters.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, filters.Status)
		argPos++
	}

	query += " ORDER BY created_at DESC"

	rows, err := r.db.Query(context.Background(), query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	commissions := []*domain.AffiliateCommission{}
	for rows.Next() {
		c, err := scanCommission(rows)
		if err != nil {
			return nil, err
		}
		commissions = append(commissions, c)
	}
	return commissions, nil
}

func (r *PostgresAffiliateRepository) UpdateCommission(c *domain.AffiliateCommission) error {
	query := `
		UPDATE affiliate_commissions SET
			status = $2, paid_at = $3, paid_by = $4, payment_notes = $5, updated_at = NOW()
		WHERE id = $1
	`
	var paidBy interface{}
	if c.PaidBy != "" {
		paidBy = c.PaidBy
	}
	_, err := r.db.Exec(context.Background(), query, c.ID, c.Status, c.PaidAt, paidBy, c.PaymentNotes)
	return err
}

func (r *PostgresAffiliateRepository) GetAffiliateStats(affiliateID string) (*domain.AffiliateStats, error) {
	query := `
		SELECT
			COUNT(*) FILTER (WHERE status = 'pending'),
			COUNT(*) FILTER (WHERE status = 'approved'),
			COUNT(*) FILTER (WHERE status = 'rejected'),
			COALESCE(SUM(final_price) FILTER (WHERE status = 'approved'), 0)
		FROM affiliate_order_requests
		WHERE affiliate_id = $1
	`

	var stats domain.AffiliateStats
	err := r.db.QueryRow(context.Background(), query, affiliateID).Scan(
		&stats.PendingRequests, &stats.ApprovedRequests, &stats.RejectedRequests, &stats.TotalOrdersAmount,
	)
	if err != nil {
		return nil, err
	}

	commissionQuery := `
		SELECT
			COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0),
			COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0)
		FROM affiliate_commissions
		WHERE affiliate_id = $1
	`
	err = r.db.QueryRow(context.Background(), commissionQuery, affiliateID).Scan(
		&stats.CommissionPending, &stats.CommissionPaid,
	)
	if err != nil {
		return nil, err
	}

	return &stats, nil
}
