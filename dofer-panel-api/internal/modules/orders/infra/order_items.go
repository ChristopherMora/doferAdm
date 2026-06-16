package infra

import (
	"context"
	"database/sql"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

// CreateOrderItem crea un nuevo item para una orden
func (r *PostgresOrderRepository) CreateOrderItem(item *domain.OrderItem) error {
	query := `
		INSERT INTO order_items (
			id, organization_id, order_id, product_name, description, quantity, unit_price, total, is_completed
		)
		SELECT $1, organization_id, $2, $3, $4, $5, $6, $7, $8
		FROM orders
		WHERE id = $2 AND organization_id = $9
	`

	_, err := r.db.Exec(
		context.Background(),
		query,
		item.ID,
		item.OrderID,
		item.ProductName,
		item.Description,
		item.Quantity,
		item.UnitPrice,
		item.Total,
		item.IsCompleted,
		item.OrganizationID,
	)

	return err
}

// GetOrderItems obtiene todos los items de una orden
func (r *PostgresOrderRepository) GetOrderItems(orderID, organizationID string) ([]*domain.OrderItem, error) {
	query := `
		SELECT id, organization_id, order_id, product_name, description, quantity, unit_price, total,
		       is_completed, completed_at, created_at
		FROM order_items
		WHERE order_id = $1 AND organization_id = $2
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(context.Background(), query, orderID, organizationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*domain.OrderItem
	for rows.Next() {
		var item domain.OrderItem
		var completedAt sql.NullTime

		err := rows.Scan(
			&item.ID,
			&item.OrganizationID,
			&item.OrderID,
			&item.ProductName,
			&item.Description,
			&item.Quantity,
			&item.UnitPrice,
			&item.Total,
			&item.IsCompleted,
			&completedAt,
			&item.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if completedAt.Valid {
			item.CompletedAt = &completedAt.Time
		}

		items = append(items, &item)
	}

	return items, nil
}

// UpdateOrderItemStatus actualiza el estado completado de un item
func (r *PostgresOrderRepository) UpdateOrderItemStatus(orderID, itemID, organizationID string, isCompleted bool) error {
	query := `
		UPDATE order_items
		SET is_completed = $1, completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END
		WHERE id = $2 AND order_id = $3 AND organization_id = $4
	`

	_, err := r.db.Exec(context.Background(), query, isCompleted, itemID, orderID, organizationID)
	return err
}

// DeleteOrderItem elimina un item de una orden
func (r *PostgresOrderRepository) DeleteOrderItem(orderID, itemID, organizationID string) error {
	query := `DELETE FROM order_items WHERE id = $1 AND order_id = $2 AND organization_id = $3`
	_, err := r.db.Exec(context.Background(), query, itemID, orderID, organizationID)
	return err
}
