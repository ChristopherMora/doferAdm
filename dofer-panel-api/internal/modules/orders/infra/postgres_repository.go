package infra

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresOrderRepository struct {
	db *pgxpool.Pool
}

func NewPostgresOrderRepository(db *pgxpool.Pool) *PostgresOrderRepository {
	return &PostgresOrderRepository{db: db}
}

func (r *PostgresOrderRepository) Create(order *domain.Order) error {
	query := `
		INSERT INTO orders (
			id, public_id, order_number, platform, status, priority,
			customer_name, customer_email, customer_phone,
			product_name, quantity, notes, internal_notes, metadata,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	metadata, _ := json.Marshal(order.Metadata)

	_, err := r.db.Exec(
		context.Background(),
		query,
		order.ID,
		order.PublicID,
		order.OrderNumber,
		order.Platform,
		order.Status,
		order.Priority,
		order.CustomerName,
		order.CustomerEmail,
		order.CustomerPhone,
		order.ProductName,
		order.Quantity,
		order.Notes,
		order.InternalNotes,
		metadata,
		order.CreatedAt,
		order.UpdatedAt,
	)

	return err
}

func (r *PostgresOrderRepository) FindByID(id string) (*domain.Order, error) {
	query := `
		SELECT id, public_id, order_number, platform, status, priority,
			customer_name, customer_email, customer_phone,
			product_id, product_name, quantity, notes, internal_notes, metadata,
			assigned_to, assigned_at, created_at, updated_at, completed_at
		FROM orders
		WHERE id = $1
	`

	return r.scanOrder(r.db.QueryRow(context.Background(), query, id))
}

func (r *PostgresOrderRepository) FindByPublicID(publicID string) (*domain.Order, error) {
	query := `
		SELECT id, public_id, order_number, platform, status, priority,
			customer_name, customer_email, customer_phone,
			product_id, product_name, quantity, notes, internal_notes, metadata,
			assigned_to, assigned_at, created_at, updated_at, completed_at
		FROM orders
		WHERE public_id = $1
	`

	return r.scanOrder(r.db.QueryRow(context.Background(), query, publicID))
}

func (r *PostgresOrderRepository) FindAll(filters domain.OrderFilters) ([]*domain.Order, error) {
	query := `
		SELECT id, public_id, order_number, platform, status, priority,
			customer_name, customer_email, customer_phone,
			product_id, product_name, quantity, notes, internal_notes, metadata,
			assigned_to, assigned_at, created_at, updated_at, completed_at
		FROM orders
		WHERE 1=1
	`

	args := []interface{}{}
	argPos := 1

	if filters.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, filters.Status)
		argPos++
	}

	if filters.Platform != "" {
		query += fmt.Sprintf(" AND platform = $%d", argPos)
		args = append(args, filters.Platform)
		argPos++
	}

	if filters.AssignedTo != "" {
		query += fmt.Sprintf(" AND assigned_to = $%d", argPos)
		args = append(args, filters.AssignedTo)
		argPos++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argPos)
	args = append(args, filters.Limit)
	argPos++

	query += fmt.Sprintf(" OFFSET $%d", argPos)
	args = append(args, filters.Offset)

	rows, err := r.db.Query(context.Background(), query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := []*domain.Order{}
	for rows.Next() {
		order, err := r.scanOrderFromRows(rows)
		if err != nil {
			return nil, err
		}
		orders = append(orders, order)
	}

	return orders, nil
}

func (r *PostgresOrderRepository) Update(order *domain.Order) error {
	query := `
		UPDATE orders SET
			status = $2,
			priority = $3,
			notes = $4,
			internal_notes = $5,
			assigned_to = $6,
			assigned_at = $7,
			updated_at = $8,
			completed_at = $9
		WHERE id = $1
	`

	// Handle NULL values for optional fields
	var assignedTo interface{}
	if order.AssignedTo == "" {
		assignedTo = nil
	} else {
		assignedTo = order.AssignedTo
	}

	var notes interface{}
	if order.Notes == "" {
		notes = nil
	} else {
		notes = order.Notes
	}

	var internalNotes interface{}
	if order.InternalNotes == "" {
		internalNotes = nil
	} else {
		internalNotes = order.InternalNotes
	}

	_, err := r.db.Exec(
		context.Background(),
		query,
		order.ID,
		order.Status,
		order.Priority,
		notes,
		internalNotes,
		assignedTo,
		order.AssignedAt,
		order.UpdatedAt,
		order.CompletedAt,
	)

	return err
}

func (r *PostgresOrderRepository) scanOrder(row pgx.Row) (*domain.Order, error) {
	var order domain.Order
	var metadataJSON []byte
	var productID, customerEmail, customerPhone, notes, internalNotes, assignedTo sql.NullString
	var assignedAt, completedAt sql.NullTime

	err := row.Scan(
		&order.ID,
		&order.PublicID,
		&order.OrderNumber,
		&order.Platform,
		&order.Status,
		&order.Priority,
		&order.CustomerName,
		&customerEmail,
		&customerPhone,
		&productID,
		&order.ProductName,
		&order.Quantity,
		&notes,
		&internalNotes,
		&metadataJSON,
		&assignedTo,
		&assignedAt,
		&order.CreatedAt,
		&order.UpdatedAt,
		&completedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("order not found")
		}
		return nil, err
	}

	if productID.Valid {
		order.ProductID = productID.String
	}
	if customerEmail.Valid {
		order.CustomerEmail = customerEmail.String
	}
	if customerPhone.Valid {
		order.CustomerPhone = customerPhone.String
	}
	if notes.Valid {
		order.Notes = notes.String
	}
	if internalNotes.Valid {
		order.InternalNotes = internalNotes.String
	}
	if assignedTo.Valid {
		order.AssignedTo = assignedTo.String
	}
	if assignedAt.Valid {
		t := assignedAt.Time
		order.AssignedAt = &t
	}
	if completedAt.Valid {
		t := completedAt.Time
		order.CompletedAt = &t
	}

	if len(metadataJSON) > 0 {
		json.Unmarshal(metadataJSON, &order.Metadata)
	}

	return &order, nil
}

func (r *PostgresOrderRepository) scanOrderFromRows(rows pgx.Rows) (*domain.Order, error) {
	var order domain.Order
	var metadataJSON []byte
	var productID, customerEmail, customerPhone, notes, internalNotes, assignedTo sql.NullString
	var assignedAt, completedAt sql.NullTime

	err := rows.Scan(
		&order.ID,
		&order.PublicID,
		&order.OrderNumber,
		&order.Platform,
		&order.Status,
		&order.Priority,
		&order.CustomerName,
		&customerEmail,
		&customerPhone,
		&productID,
		&order.ProductName,
		&order.Quantity,
		&notes,
		&internalNotes,
		&metadataJSON,
		&assignedTo,
		&assignedAt,
		&order.CreatedAt,
		&order.UpdatedAt,
		&completedAt,
	)

	if err != nil {
		return nil, err
	}

	if productID.Valid {
		order.ProductID = productID.String
	}
	if customerEmail.Valid {
		order.CustomerEmail = customerEmail.String
	}
	if customerPhone.Valid {
		order.CustomerPhone = customerPhone.String
	}
	if notes.Valid {
		order.Notes = notes.String
	}
	if internalNotes.Valid {
		order.InternalNotes = internalNotes.String
	}
	if assignedTo.Valid {
		order.AssignedTo = assignedTo.String
	}
	if assignedAt.Valid {
		t := assignedAt.Time
		order.AssignedAt = &t
	}
	if completedAt.Valid {
		t := completedAt.Time
		order.CompletedAt = &t
	}

	if len(metadataJSON) > 0 {
		json.Unmarshal(metadataJSON, &order.Metadata)
	}

	return &order, nil
}
