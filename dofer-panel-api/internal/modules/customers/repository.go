package customers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// GetAll retrieves all customers with optional filters
func (r *Repository) GetAll(ctx context.Context, status, tier, segment string, limit, offset int) ([]Customer, error) {
	query := `SELECT * FROM customers WHERE 1=1`
	args := []interface{}{}
	argNum := 1

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
func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*Customer, error) {
	query := "SELECT * FROM customers WHERE id = $1"
	rows, err := r.db.Query(ctx, query, id)
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
func (r *Repository) GetByEmail(ctx context.Context, email string) (*Customer, error) {
	query := "SELECT * FROM customers WHERE email = $1"
	rows, err := r.db.Query(ctx, query, email)
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
func (r *Repository) Create(ctx context.Context, req CreateCustomerRequest, userID uuid.UUID) (*Customer, error) {
	tagsJSON, _ := json.Marshal(req.Tags)
	materialsJSON, _ := json.Marshal(req.PreferredMaterials)

	query := `
		INSERT INTO customers (
			name, email, phone, company, tax_id,
			address_line1, address_line2, city, state, postal_code, country,
			billing_name, billing_email, billing_address,
			preferred_payment_method, preferred_materials,
			internal_notes, tags, accepts_marketing, acquisition_source,
			created_by
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, $11,
			$12, $13, $14,
			$15, $16,
			$17, $18, $19, $20,
			$21
		) RETURNING *
	`

	rows, err := r.db.Query(ctx, query,
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
func (r *Repository) Update(ctx context.Context, id uuid.UUID, req UpdateCustomerRequest) (*Customer, error) {
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

	query += fmt.Sprintf(" WHERE id = $%d RETURNING *", argNum)
	args = append(args, id)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customer, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Customer])
	return &customer, err
}

// Delete deletes a customer
func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM customers WHERE id = $1", id)
	return err
}

// Search searches customers
func (r *Repository) Search(ctx context.Context, term string) ([]Customer, error) {
	query := `SELECT * FROM customers WHERE name ILIKE $1 OR email ILIKE $1 ORDER BY name LIMIT 20`
	rows, err := r.db.Query(ctx, query, "%"+term+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customers, err := pgx.CollectRows(rows, pgx.RowToStructByName[Customer])
	return customers, err
}

// GetAnalytics retrieves customer analytics
func (r *Repository) GetAnalytics(ctx context.Context, limit int) ([]CustomerAnalytics, error) {
	query := "SELECT * FROM customer_analytics ORDER BY total_spent DESC"
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	analytics, err := pgx.CollectRows(rows, pgx.RowToStructByName[CustomerAnalytics])
	return analytics, err
}

// GetStats retrieves overall customer statistics
func (r *Repository) GetStats(ctx context.Context) (map[string]interface{}, error) {
	query := `
		SELECT
			COUNT(*) as total_customers,
			COUNT(*) FILTER (WHERE status = 'active') as active_customers,
			COUNT(*) FILTER (WHERE customer_tier = 'vip') as vip_customers,
			AVG(total_spent) as avg_lifetime_value,
			SUM(total_spent) as total_revenue
		FROM customers
	`

	row := r.db.QueryRow(ctx, query)
	
	var totalCustomers, activeCustomers, vipCustomers int
	var avgLifetimeValue, totalRevenue float64
	
	err := row.Scan(&totalCustomers, &activeCustomers, &vipCustomers, &avgLifetimeValue, &totalRevenue)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_customers":     totalCustomers,
		"active_customers":    activeCustomers,
		"vip_customers":       vipCustomers,
		"avg_lifetime_value":  avgLifetimeValue,
		"total_revenue":       totalRevenue,
	}, nil
}

// GetInteractions retrieves customer interactions
func (r *Repository) GetInteractions(ctx context.Context, customerID uuid.UUID) ([]CustomerInteraction, error) {
	query := "SELECT * FROM customer_interactions WHERE customer_id = $1 ORDER BY created_at DESC"
	rows, err := r.db.Query(ctx, query, customerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	interactions, err := pgx.CollectRows(rows, pgx.RowToStructByName[CustomerInteraction])
	return interactions, err
}

// CreateInteraction creates a new interaction
func (r *Repository) CreateInteraction(ctx context.Context, customerID uuid.UUID, req CreateInteractionRequest, userID uuid.UUID) (*CustomerInteraction, error) {
	query := `
		INSERT INTO customer_interactions (
			customer_id, interaction_type, subject, description, priority, assigned_to, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING *
	`

	rows, err := r.db.Query(ctx, query,
		customerID, req.InteractionType, req.Subject, req.Description,
		req.Priority, req.AssignedTo, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	interaction, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[CustomerInteraction])
	return &interaction, err
}
