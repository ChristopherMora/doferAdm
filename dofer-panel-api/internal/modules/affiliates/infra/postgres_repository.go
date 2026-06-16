package infra

import (
	"context"
	"database/sql"
	"encoding/json"
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
	id, organization_id, user_id, referral_code, display_name, email, phone, commission_type, commission_value,
	max_pending_requests, allow_urgent_orders, status, notes, created_by, created_at, updated_at
`

func scanAffiliate(row pgx.Row) (*domain.Affiliate, error) {
	var a domain.Affiliate
	var phone, notes, createdBy sql.NullString

	err := row.Scan(
		&a.ID, &a.OrganizationID, &a.UserID, &a.ReferralCode, &a.DisplayName, &a.Email, &phone,
		&a.CommissionType, &a.CommissionValue, &a.MaxPendingRequests, &a.AllowUrgentOrders, &a.Status, &notes, &createdBy,
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
			id, organization_id, user_id, referral_code, display_name, email, phone, commission_type,
			commission_value, max_pending_requests, allow_urgent_orders, status, notes, created_by
		) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at
	`

	var createdBy interface{}
	if a.CreatedBy != "" {
		createdBy = a.CreatedBy
	}

	return r.db.QueryRow(context.Background(), query,
		a.OrganizationID, a.UserID, a.ReferralCode, a.DisplayName, a.Email, a.Phone, a.CommissionType,
		a.CommissionValue, a.MaxPendingRequests, a.AllowUrgentOrders, a.Status, a.Notes, createdBy,
	).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
}

func (r *PostgresAffiliateRepository) FindAffiliateByID(id string, organizationID ...string) (*domain.Affiliate, error) {
	query := `SELECT ` + affiliateColumns + ` FROM affiliates WHERE id = $1`
	args := []interface{}{id}
	if len(organizationID) > 0 && organizationID[0] != "" {
		query += " AND organization_id = $2"
		args = append(args, organizationID[0])
	}
	a, err := scanAffiliate(r.db.QueryRow(context.Background(), query, args...))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("affiliate not found")
		}
		return nil, err
	}
	return a, nil
}

func (r *PostgresAffiliateRepository) FindAffiliateByUserID(userID string, organizationID ...string) (*domain.Affiliate, error) {
	query := `SELECT ` + affiliateColumns + ` FROM affiliates WHERE user_id = $1`
	args := []interface{}{userID}
	if len(organizationID) > 0 && organizationID[0] != "" {
		query += " AND organization_id = $2"
		args = append(args, organizationID[0])
	}
	a, err := scanAffiliate(r.db.QueryRow(context.Background(), query, args...))
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

	if filters.OrganizationID != "" {
		query += fmt.Sprintf(" AND organization_id = $%d", argPos)
		args = append(args, filters.OrganizationID)
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
			commission_value = $5, max_pending_requests = $6, allow_urgent_orders = $7,
			status = $8, notes = $9, updated_at = NOW()
		WHERE id = $1
	`
	args := []interface{}{
		a.ID, a.DisplayName, a.Phone, a.CommissionType, a.CommissionValue,
		a.MaxPendingRequests, a.AllowUrgentOrders, a.Status, a.Notes,
	}
	if a.OrganizationID != "" {
		query += " AND organization_id = $10"
		args = append(args, a.OrganizationID)
	}
	_, err := r.db.Exec(context.Background(), query, args...)
	return err
}

// CreateAffiliateUser inserta directamente la fila en `users` con role='affiliate'.
// A propósito NO reusa auth.UpsertUser (que hardcodea role='operator'): esta fila
// debe existir con el rol correcto ANTES del primer login del afiliado, para que
// el ON CONFLICT DO NOTHING de SyncUser no la pise.
func (r *PostgresAffiliateRepository) CreateAffiliateUser(id, email, fullName, organizationID string) error {
	ctx := context.Background()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO users (id, email, full_name, role, created_at, updated_at)
		VALUES ($1, $2, $3, 'affiliate', NOW(), NOW())
		ON CONFLICT (id) DO UPDATE
		SET email = EXCLUDED.email,
		    full_name = EXCLUDED.full_name,
		    role = 'affiliate',
		    updated_at = NOW()
	`, id, email, fullName)
	if err != nil {
		return err
	}

	if organizationID != "" {
		_, err = tx.Exec(ctx, `
			INSERT INTO organization_members (organization_id, user_id, role)
			VALUES ($1, $2, 'viewer')
			ON CONFLICT (organization_id, user_id) DO NOTHING
		`, organizationID, id)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

const orderRequestColumns = `
	id, organization_id, affiliate_id, product_id, product_name, quantity, suggested_price_snapshot,
	min_price_snapshot, final_price, priority, reference_images, customer_name, customer_email, customer_phone, customer_notes,
	status, requested_changes, rejection_reason, reviewed_by, reviewed_at,
	cancelled_reason, cancelled_by, cancelled_at, order_id,
	commission_type_snapshot, commission_value_snapshot, created_at, updated_at
`

func scanOrderRequest(row pgx.Row) (*domain.AffiliateOrderRequest, error) {
	var req domain.AffiliateOrderRequest
	var productID, customerEmail, customerPhone, customerNotes, requestedChanges, rejectionReason, reviewedBy, cancelledReason, cancelledBy, orderID, commissionTypeSnapshot sql.NullString
	var suggestedPriceSnapshot, minPriceSnapshot, commissionValueSnapshot sql.NullFloat64
	var reviewedAt, cancelledAt sql.NullTime
	var referenceImagesJSON []byte

	err := row.Scan(
		&req.ID, &req.OrganizationID, &req.AffiliateID, &productID, &req.ProductName, &req.Quantity, &suggestedPriceSnapshot,
		&minPriceSnapshot, &req.FinalPrice, &req.Priority, &referenceImagesJSON, &req.CustomerName, &customerEmail, &customerPhone, &customerNotes,
		&req.Status, &requestedChanges, &rejectionReason, &reviewedBy, &reviewedAt,
		&cancelledReason, &cancelledBy, &cancelledAt, &orderID,
		&commissionTypeSnapshot, &commissionValueSnapshot, &req.CreatedAt, &req.UpdatedAt,
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
	if minPriceSnapshot.Valid {
		req.MinPriceSnapshot = minPriceSnapshot.Float64
	}
	if len(referenceImagesJSON) > 0 {
		_ = json.Unmarshal(referenceImagesJSON, &req.ReferenceImages)
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
	if requestedChanges.Valid {
		req.RequestedChanges = requestedChanges.String
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
	if cancelledReason.Valid {
		req.CancelledReason = cancelledReason.String
	}
	if cancelledBy.Valid {
		req.CancelledBy = cancelledBy.String
	}
	if cancelledAt.Valid {
		t := cancelledAt.Time
		req.CancelledAt = &t
	}
	if orderID.Valid {
		req.OrderID = orderID.String
	}
	if commissionTypeSnapshot.Valid {
		req.CommissionTypeSnapshot = commissionTypeSnapshot.String
	}
	if commissionValueSnapshot.Valid {
		req.CommissionValueSnapshot = commissionValueSnapshot.Float64
	}

	return &req, nil
}

func (r *PostgresAffiliateRepository) CreateOrderRequest(req *domain.AffiliateOrderRequest) error {
	query := `
		INSERT INTO affiliate_order_requests (
			id, organization_id, affiliate_id, product_id, product_name, quantity, suggested_price_snapshot,
			min_price_snapshot, final_price, priority, reference_images, customer_name,
			customer_email, customer_phone, customer_notes, status, commission_type_snapshot, commission_value_snapshot
		) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, created_at, updated_at
	`

	var productID interface{}
	if req.ProductID != "" {
		productID = req.ProductID
	}
	referenceImages, _ := json.Marshal(req.ReferenceImages)

	return r.db.QueryRow(context.Background(), query,
		req.OrganizationID, req.AffiliateID, productID, req.ProductName, req.Quantity, req.SuggestedPriceSnapshot,
		req.MinPriceSnapshot, req.FinalPrice, req.Priority, referenceImages, req.CustomerName,
		req.CustomerEmail, req.CustomerPhone, req.CustomerNotes, req.Status,
		nullableString(req.CommissionTypeSnapshot), nullableFloat(req.CommissionValueSnapshot),
	).Scan(&req.ID, &req.CreatedAt, &req.UpdatedAt)
}

func (r *PostgresAffiliateRepository) FindOrderRequestByID(id string, organizationID ...string) (*domain.AffiliateOrderRequest, error) {
	query := `SELECT ` + orderRequestColumns + ` FROM affiliate_order_requests WHERE id = $1`
	args := []interface{}{id}
	if len(organizationID) > 0 && organizationID[0] != "" {
		query += " AND organization_id = $2"
		args = append(args, organizationID[0])
	}
	req, err := scanOrderRequest(r.db.QueryRow(context.Background(), query, args...))
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

	if filters.OrganizationID != "" {
		query += fmt.Sprintf(" AND req.organization_id = $%d", argPos)
		args = append(args, filters.OrganizationID)
		argPos++
	}

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

	if filters.Priority != "" {
		query += fmt.Sprintf(" AND req.priority = $%d", argPos)
		args = append(args, filters.Priority)
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
	return `req.id, req.organization_id, req.affiliate_id, req.product_id, req.product_name, req.quantity,
		req.suggested_price_snapshot, req.min_price_snapshot, req.final_price, req.priority,
		req.reference_images, req.customer_name, req.customer_email,
		req.customer_phone, req.customer_notes, req.status, req.requested_changes, req.rejection_reason,
		req.reviewed_by, req.reviewed_at, req.cancelled_reason, req.cancelled_by, req.cancelled_at,
		req.order_id, req.commission_type_snapshot, req.commission_value_snapshot, req.created_at, req.updated_at`
}

func scanOrderRequestWithOrderStatus(rows pgx.Rows) (*domain.AffiliateOrderRequest, string, error) {
	var req domain.AffiliateOrderRequest
	var productID, customerEmail, customerPhone, customerNotes, requestedChanges, rejectionReason, reviewedBy, cancelledReason, cancelledBy, orderID, commissionTypeSnapshot sql.NullString
	var suggestedPriceSnapshot, minPriceSnapshot, commissionValueSnapshot sql.NullFloat64
	var reviewedAt, cancelledAt sql.NullTime
	var referenceImagesJSON []byte
	var orderStatus string

	err := rows.Scan(
		&req.ID, &req.OrganizationID, &req.AffiliateID, &productID, &req.ProductName, &req.Quantity, &suggestedPriceSnapshot,
		&minPriceSnapshot, &req.FinalPrice, &req.Priority, &referenceImagesJSON, &req.CustomerName, &customerEmail, &customerPhone, &customerNotes,
		&req.Status, &requestedChanges, &rejectionReason, &reviewedBy, &reviewedAt,
		&cancelledReason, &cancelledBy, &cancelledAt, &orderID,
		&commissionTypeSnapshot, &commissionValueSnapshot, &req.CreatedAt, &req.UpdatedAt,
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
	if minPriceSnapshot.Valid {
		req.MinPriceSnapshot = minPriceSnapshot.Float64
	}
	if len(referenceImagesJSON) > 0 {
		_ = json.Unmarshal(referenceImagesJSON, &req.ReferenceImages)
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
	if requestedChanges.Valid {
		req.RequestedChanges = requestedChanges.String
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
	if cancelledReason.Valid {
		req.CancelledReason = cancelledReason.String
	}
	if cancelledBy.Valid {
		req.CancelledBy = cancelledBy.String
	}
	if cancelledAt.Valid {
		t := cancelledAt.Time
		req.CancelledAt = &t
	}
	if orderID.Valid {
		req.OrderID = orderID.String
	}
	if commissionTypeSnapshot.Valid {
		req.CommissionTypeSnapshot = commissionTypeSnapshot.String
	}
	if commissionValueSnapshot.Valid {
		req.CommissionValueSnapshot = commissionValueSnapshot.Float64
	}

	return &req, orderStatus, nil
}

func (r *PostgresAffiliateRepository) UpdateOrderRequest(req *domain.AffiliateOrderRequest) error {
	query := `
		UPDATE affiliate_order_requests SET
			status = $2, requested_changes = $3, rejection_reason = $4, reviewed_by = $5, reviewed_at = $6,
			cancelled_reason = $7, cancelled_by = $8, cancelled_at = $9, order_id = $10, updated_at = NOW()
		WHERE id = $1
	`

	var reviewedBy, orderID, rejectionReason, requestedChanges, cancelledBy, cancelledReason interface{}
	if req.ReviewedBy != "" {
		reviewedBy = req.ReviewedBy
	}
	if req.OrderID != "" {
		orderID = req.OrderID
	}
	if req.RejectionReason != "" {
		rejectionReason = req.RejectionReason
	}
	if req.RequestedChanges != "" {
		requestedChanges = req.RequestedChanges
	}
	if req.CancelledBy != "" {
		cancelledBy = req.CancelledBy
	}
	if req.CancelledReason != "" {
		cancelledReason = req.CancelledReason
	}

	args := []interface{}{
		req.ID, req.Status, requestedChanges, rejectionReason, reviewedBy, req.ReviewedAt,
		cancelledReason, cancelledBy, req.CancelledAt, orderID,
	}
	if req.OrganizationID != "" {
		query += " AND organization_id = $11"
		args = append(args, req.OrganizationID)
	}

	_, err := r.db.Exec(context.Background(), query, args...)
	return err
}

func (r *PostgresAffiliateRepository) UpdateOrderRequestDetails(req *domain.AffiliateOrderRequest) error {
	query := `
		UPDATE affiliate_order_requests SET
			product_id = $2, product_name = $3, quantity = $4, suggested_price_snapshot = $5,
			min_price_snapshot = $6, final_price = $7, priority = $8, reference_images = $9,
			customer_name = $10, customer_email = $11, customer_phone = $12, customer_notes = $13,
			status = $14, requested_changes = $15, commission_type_snapshot = $16,
			commission_value_snapshot = $17, updated_at = NOW()
		WHERE id = $1
	`
	var productID interface{}
	if req.ProductID != "" {
		productID = req.ProductID
	}
	referenceImages, _ := json.Marshal(req.ReferenceImages)
	args := []interface{}{
		req.ID, productID, req.ProductName, req.Quantity, req.SuggestedPriceSnapshot,
		req.MinPriceSnapshot, req.FinalPrice, req.Priority, referenceImages, req.CustomerName,
		req.CustomerEmail, req.CustomerPhone, req.CustomerNotes, req.Status, nullableString(req.RequestedChanges),
		nullableString(req.CommissionTypeSnapshot), nullableFloat(req.CommissionValueSnapshot),
	}
	if req.OrganizationID != "" {
		query += " AND organization_id = $18"
		args = append(args, req.OrganizationID)
	}
	_, err := r.db.Exec(context.Background(), query, args...)
	return err
}

func (r *PostgresAffiliateRepository) CountOpenOrderRequests(organizationID, affiliateID string) (int, error) {
	var count int
	err := r.db.QueryRow(context.Background(), `
		SELECT COUNT(*)
		FROM affiliate_order_requests
		WHERE organization_id = $1
		  AND affiliate_id = $2
		  AND status IN ('pending', 'needs_changes')
	`, organizationID, affiliateID).Scan(&count)
	return count, err
}

func (r *PostgresAffiliateRepository) CreateOrderRequestEvent(event *domain.AffiliateOrderRequestEvent) error {
	if event.Metadata == nil {
		event.Metadata = map[string]interface{}{}
	}
	metadataJSON, _ := json.Marshal(event.Metadata)
	query := `
		INSERT INTO affiliate_order_request_events (
			id, organization_id, affiliate_order_request_id, actor_user_id, actor_role,
			event_type, message, metadata
		) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	return r.db.QueryRow(context.Background(), query,
		event.OrganizationID,
		event.AffiliateOrderRequestID,
		nullableString(event.ActorUserID),
		event.ActorRole,
		event.EventType,
		event.Message,
		metadataJSON,
	).Scan(&event.ID, &event.CreatedAt)
}

func (r *PostgresAffiliateRepository) ListOrderRequestEvents(organizationID, requestID string) ([]*domain.AffiliateOrderRequestEvent, error) {
	rows, err := r.db.Query(context.Background(), `
		SELECT id, organization_id, affiliate_order_request_id, actor_user_id, actor_role,
		       event_type, message, metadata, created_at
		FROM affiliate_order_request_events
		WHERE organization_id = $1
		  AND affiliate_order_request_id = $2
		ORDER BY created_at ASC
	`, organizationID, requestID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []*domain.AffiliateOrderRequestEvent{}
	for rows.Next() {
		var event domain.AffiliateOrderRequestEvent
		var actorUserID, message sql.NullString
		var metadataJSON []byte
		if err := rows.Scan(
			&event.ID,
			&event.OrganizationID,
			&event.AffiliateOrderRequestID,
			&actorUserID,
			&event.ActorRole,
			&event.EventType,
			&message,
			&metadataJSON,
			&event.CreatedAt,
		); err != nil {
			return nil, err
		}
		if actorUserID.Valid {
			event.ActorUserID = actorUserID.String
		}
		if message.Valid {
			event.Message = message.String
		}
		if len(metadataJSON) > 0 {
			_ = json.Unmarshal(metadataJSON, &event.Metadata)
		}
		events = append(events, &event)
	}
	return events, rows.Err()
}

func (r *PostgresAffiliateRepository) CreateOrderRequestComment(comment *domain.AffiliateOrderRequestComment) error {
	query := `
		INSERT INTO affiliate_order_request_comments (
			id, organization_id, affiliate_order_request_id, author_user_id, author_role,
			message, internal_only
		) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`
	return r.db.QueryRow(context.Background(), query,
		comment.OrganizationID,
		comment.AffiliateOrderRequestID,
		nullableString(comment.AuthorUserID),
		comment.AuthorRole,
		comment.Message,
		comment.InternalOnly,
	).Scan(&comment.ID, &comment.CreatedAt)
}

func (r *PostgresAffiliateRepository) ListOrderRequestComments(organizationID, requestID string, includeInternal bool) ([]*domain.AffiliateOrderRequestComment, error) {
	query := `
		SELECT id, organization_id, affiliate_order_request_id, author_user_id, author_role,
		       message, internal_only, created_at
		FROM affiliate_order_request_comments
		WHERE organization_id = $1
		  AND affiliate_order_request_id = $2
	`
	args := []interface{}{organizationID, requestID}
	if !includeInternal {
		query += " AND internal_only = false"
	}
	query += " ORDER BY created_at ASC"

	rows, err := r.db.Query(context.Background(), query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := []*domain.AffiliateOrderRequestComment{}
	for rows.Next() {
		var comment domain.AffiliateOrderRequestComment
		var authorUserID sql.NullString
		if err := rows.Scan(
			&comment.ID,
			&comment.OrganizationID,
			&comment.AffiliateOrderRequestID,
			&authorUserID,
			&comment.AuthorRole,
			&comment.Message,
			&comment.InternalOnly,
			&comment.CreatedAt,
		); err != nil {
			return nil, err
		}
		if authorUserID.Valid {
			comment.AuthorUserID = authorUserID.String
		}
		comments = append(comments, &comment)
	}
	return comments, rows.Err()
}

const commissionColumns = `
	id, organization_id, affiliate_id, affiliate_order_request_id, order_id, commission_amount,
	status, paid_at, paid_by, paid_batch_id, payment_method, payment_reference, payment_notes, created_at, updated_at
`

func scanCommission(row pgx.Row) (*domain.AffiliateCommission, error) {
	var c domain.AffiliateCommission
	var paidBy, paidBatchID, paymentMethod, paymentReference, paymentNotes sql.NullString
	var paidAt sql.NullTime

	err := row.Scan(
		&c.ID, &c.OrganizationID, &c.AffiliateID, &c.AffiliateOrderRequestID, &c.OrderID, &c.CommissionAmount,
		&c.Status, &paidAt, &paidBy, &paidBatchID, &paymentMethod, &paymentReference, &paymentNotes, &c.CreatedAt, &c.UpdatedAt,
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
	if paidBatchID.Valid {
		c.PaidBatchID = paidBatchID.String
	}
	if paymentMethod.Valid {
		c.PaymentMethod = paymentMethod.String
	}
	if paymentReference.Valid {
		c.PaymentReference = paymentReference.String
	}
	if paymentNotes.Valid {
		c.PaymentNotes = paymentNotes.String
	}

	return &c, nil
}

func (r *PostgresAffiliateRepository) CreateCommission(c *domain.AffiliateCommission) error {
	query := `
		INSERT INTO affiliate_commissions (
			id, organization_id, affiliate_id, affiliate_order_request_id, order_id, commission_amount, status
		) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(context.Background(), query,
		c.OrganizationID, c.AffiliateID, c.AffiliateOrderRequestID, c.OrderID, c.CommissionAmount, c.Status,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *PostgresAffiliateRepository) FindCommissionByID(id string, organizationID ...string) (*domain.AffiliateCommission, error) {
	query := `SELECT ` + commissionColumns + ` FROM affiliate_commissions WHERE id = $1`
	args := []interface{}{id}
	if len(organizationID) > 0 && organizationID[0] != "" {
		query += " AND organization_id = $2"
		args = append(args, organizationID[0])
	}
	c, err := scanCommission(r.db.QueryRow(context.Background(), query, args...))
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

	if filters.OrganizationID != "" {
		query += fmt.Sprintf(" AND organization_id = $%d", argPos)
		args = append(args, filters.OrganizationID)
		argPos++
	}

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
			status = $2, paid_at = $3, paid_by = $4, paid_batch_id = $5,
			payment_method = $6, payment_reference = $7, payment_notes = $8, updated_at = NOW()
		WHERE id = $1
	`
	var paidBy, paidBatchID interface{}
	if c.PaidBy != "" {
		paidBy = c.PaidBy
	}
	if c.PaidBatchID != "" {
		paidBatchID = c.PaidBatchID
	}
	args := []interface{}{
		c.ID, c.Status, c.PaidAt, paidBy, paidBatchID, c.PaymentMethod, c.PaymentReference, c.PaymentNotes,
	}
	if c.OrganizationID != "" {
		query += " AND organization_id = $9"
		args = append(args, c.OrganizationID)
	}
	_, err := r.db.Exec(context.Background(), query, args...)
	return err
}

func (r *PostgresAffiliateRepository) GetAffiliateStats(affiliateID string, organizationID ...string) (*domain.AffiliateStats, error) {
	query := `
		SELECT
			COUNT(*) FILTER (WHERE status IN ('pending', 'needs_changes')),
			COUNT(*) FILTER (WHERE status = 'approved'),
			COUNT(*) FILTER (WHERE status = 'rejected'),
			COALESCE(SUM(final_price) FILTER (WHERE status = 'approved'), 0)
		FROM affiliate_order_requests
		WHERE affiliate_id = $1
	`
	args := []interface{}{affiliateID}
	if len(organizationID) > 0 && organizationID[0] != "" {
		query += " AND organization_id = $2"
		args = append(args, organizationID[0])
	}

	var stats domain.AffiliateStats
	err := r.db.QueryRow(context.Background(), query, args...).Scan(
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
	commissionArgs := []interface{}{affiliateID}
	if len(organizationID) > 0 && organizationID[0] != "" {
		commissionQuery += " AND organization_id = $2"
		commissionArgs = append(commissionArgs, organizationID[0])
	}
	err = r.db.QueryRow(context.Background(), commissionQuery, commissionArgs...).Scan(
		&stats.CommissionPending, &stats.CommissionPaid,
	)
	if err != nil {
		return nil, err
	}

	return &stats, nil
}

func nullableString(value string) interface{} {
	if value == "" {
		return nil
	}
	return value
}

func nullableFloat(value float64) interface{} {
	if value == 0 {
		return nil
	}
	return value
}
