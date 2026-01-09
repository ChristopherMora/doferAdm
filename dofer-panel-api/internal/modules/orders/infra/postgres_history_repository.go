package infra

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresOrderHistoryRepository struct {
	db *pgxpool.Pool
}

func NewPostgresOrderHistoryRepository(db *pgxpool.Pool) *PostgresOrderHistoryRepository {
	return &PostgresOrderHistoryRepository{db: db}
}

func (r *PostgresOrderHistoryRepository) Create(entry *domain.OrderHistoryEntry) error {
	query := `
		INSERT INTO order_history (
			id, order_id, changed_by, change_type, field_name, old_value, new_value, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.Exec(
		context.Background(),
		query,
		uuid.New().String(),
		entry.OrderID,
		entry.ChangedBy,
		entry.ChangeType,
		entry.FieldName,
		entry.OldValue,
		entry.NewValue,
		entry.CreatedAt,
	)

	return err
}

func (r *PostgresOrderHistoryRepository) FindByOrderID(orderID string) ([]*domain.OrderHistoryEntry, error) {
	query := `
		SELECT id, order_id, changed_by, change_type, field_name, old_value, new_value, created_at
		FROM order_history
		WHERE order_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(context.Background(), query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*domain.OrderHistoryEntry

	for rows.Next() {
		var entry domain.OrderHistoryEntry
		err := rows.Scan(
			&entry.ID,
			&entry.OrderID,
			&entry.ChangedBy,
			&entry.ChangeType,
			&entry.FieldName,
			&entry.OldValue,
			&entry.NewValue,
			&entry.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		entries = append(entries, &entry)
	}

	return entries, nil
}
