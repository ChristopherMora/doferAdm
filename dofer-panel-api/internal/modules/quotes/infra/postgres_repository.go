package infra

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/dofer/panel-api/internal/modules/quotes/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresQuoteRepository struct {
	db *pgxpool.Pool
}

func NewPostgresQuoteRepository(db *pgxpool.Pool) *PostgresQuoteRepository {
	return &PostgresQuoteRepository{db: db}
}

func (r *PostgresQuoteRepository) Create(quote *domain.Quote) error {
	// Calcular balance inicial
	quote.Balance = quote.Total - quote.AmountPaid
	
	query := `
		INSERT INTO quotes (
			id, quote_number, customer_name, customer_email, customer_phone,
			status, subtotal, discount, tax, total, amount_paid, balance, notes, valid_until, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	_, err := r.db.Exec(context.Background(), query,
		quote.ID,
		quote.QuoteNumber,
		quote.CustomerName,
		quote.CustomerEmail,
		quote.CustomerPhone,
		quote.Status,
		quote.Subtotal,
		quote.Discount,
		quote.Tax,
		quote.Total,
		quote.AmountPaid,
		quote.Balance,
		quote.Notes,
		quote.ValidUntil,
		quote.CreatedBy,
	)

	return err
}

func (r *PostgresQuoteRepository) FindByID(id string) (*domain.Quote, error) {
	query := `
		SELECT id, quote_number, customer_name, customer_email, customer_phone,
		       status, subtotal, discount, tax, total, amount_paid, balance, notes, valid_until,
		       created_by, created_at, updated_at, 
		       COALESCE(converted_to_order_id::text, '') as converted_to_order_id
		FROM quotes
		WHERE id = $1
	`

	var quote domain.Quote
	var validUntil, createdAt, updatedAt time.Time
	var customerPhone, notes, convertedToOrderID sql.NullString

	err := r.db.QueryRow(context.Background(), query, id).Scan(
		&quote.ID,
		&quote.QuoteNumber,
		&quote.CustomerName,
		&quote.CustomerEmail,
		&customerPhone,
		&quote.Status,
		&quote.Subtotal,
		&quote.Discount,
		&quote.Tax,
		&quote.Total,
		&quote.AmountPaid,
		&quote.Balance,
		&notes,
		&validUntil,
		&quote.CreatedBy,
		&createdAt,
		&updatedAt,
		&convertedToOrderID,
	)

	if err != nil {
		return nil, err
	}

	if customerPhone.Valid {
		quote.CustomerPhone = customerPhone.String
	}
	if notes.Valid {
		quote.Notes = notes.String
	}
	if convertedToOrderID.Valid {
		quote.ConvertedToOrderID = convertedToOrderID.String
	}

	quote.ValidUntil = validUntil
	quote.CreatedAt = createdAt
	quote.UpdatedAt = updatedAt

	return &quote, nil
}

func (r *PostgresQuoteRepository) FindAll(filters map[string]interface{}) ([]*domain.Quote, error) {
	query := `
		SELECT id, quote_number, customer_name, customer_email, customer_phone,
		       status, subtotal, discount, tax, total, amount_paid, balance, notes, valid_until,
		       created_by, created_at, updated_at,
		       COALESCE(converted_to_order_id::text, '') as converted_to_order_id
		FROM quotes
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var quotes []*domain.Quote

	for rows.Next() {
		var quote domain.Quote
		var validUntil, createdAt, updatedAt time.Time
		var customerPhone, notes, convertedToOrderID sql.NullString

		err := rows.Scan(
			&quote.ID,
			&quote.QuoteNumber,
			&quote.CustomerName,
			&quote.CustomerEmail,
			&customerPhone,
			&quote.Status,
			&quote.Subtotal,
			&quote.Discount,
			&quote.Tax,
			&quote.Total,
			&quote.AmountPaid,
			&quote.Balance,
			&notes,
			&validUntil,
			&quote.CreatedBy,
			&createdAt,
			&updatedAt,
			&convertedToOrderID,
		)

		if err != nil {
			return nil, err
		}

		if customerPhone.Valid {
			quote.CustomerPhone = customerPhone.String
		}
		if notes.Valid {
			quote.Notes = notes.String
		}
		if convertedToOrderID.Valid {
			quote.ConvertedToOrderID = convertedToOrderID.String
		}

		quote.ValidUntil = validUntil
		quote.CreatedAt = createdAt
		quote.UpdatedAt = updatedAt

		// Cargar items de la cotización
		items, err := r.GetItems(quote.ID)
		if err == nil {
			quote.Items = items
		}

		quotes = append(quotes, &quote)
	}

	return quotes, nil
}

func (r *PostgresQuoteRepository) Update(quote *domain.Quote) error {
	// Calcular balance
	quote.Balance = quote.Total - quote.AmountPaid
	
	query := `
		UPDATE quotes
		SET customer_name = $1, customer_email = $2, customer_phone = $3,
		    status = $4, subtotal = $5, discount = $6, tax = $7, total = $8,
		    amount_paid = $9, balance = $10, notes = $11, valid_until = $12, updated_at = NOW(),
		    converted_to_order_id = $13
		WHERE id = $14
	`

	var convertedToOrderID *string
	if quote.ConvertedToOrderID != "" {
		convertedToOrderID = &quote.ConvertedToOrderID
	}

	_, err := r.db.Exec(context.Background(), query,
		quote.CustomerName,
		quote.CustomerEmail,
		quote.CustomerPhone,
		quote.Status,
		quote.Subtotal,
		quote.Discount,
		quote.Tax,
		quote.Total,
		quote.AmountPaid,
		quote.Balance,
		quote.Notes,
		quote.ValidUntil,
		convertedToOrderID,
		quote.ID,
	)

	return err
}

func (r *PostgresQuoteRepository) Delete(id string) error {
	query := `DELETE FROM quotes WHERE id = $1`
	_, err := r.db.Exec(context.Background(), query, id)
	return err
}

func (r *PostgresQuoteRepository) AddItem(item *domain.QuoteItem) error {
	query := `
		INSERT INTO quote_items (
			id, quote_id, product_name, description, weight_grams, print_time_hours,
			material_cost, labor_cost, electricity_cost, other_costs, subtotal,
			quantity, unit_price, total
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	_, err := r.db.Exec(context.Background(), query,
		item.ID,
		item.QuoteID,
		item.ProductName,
		item.Description,
		item.WeightGrams,
		item.PrintTimeHours,
		item.MaterialCost,
		item.LaborCost,
		item.ElectricityCost,
		item.OtherCosts,
		item.Subtotal,
		item.Quantity,
		item.UnitPrice,
		item.Total,
	)

	return err
}

func (r *PostgresQuoteRepository) GetItems(quoteID string) ([]*domain.QuoteItem, error) {
	query := `
		SELECT id, quote_id, product_name, description, weight_grams, print_time_hours,
		       material_cost, labor_cost, electricity_cost, other_costs, subtotal,
		       quantity, unit_price, total, created_at
		FROM quote_items
		WHERE quote_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(context.Background(), query, quoteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*domain.QuoteItem

	for rows.Next() {
		var item domain.QuoteItem
		var description sql.NullString

		err := rows.Scan(
			&item.ID,
			&item.QuoteID,
			&item.ProductName,
			&description,
			&item.WeightGrams,
			&item.PrintTimeHours,
			&item.MaterialCost,
			&item.LaborCost,
			&item.ElectricityCost,
			&item.OtherCosts,
			&item.Subtotal,
			&item.Quantity,
			&item.UnitPrice,
			&item.Total,
			&item.CreatedAt,
		)

		if err != nil {
			return nil, err
		}

		if description.Valid {
			item.Description = description.String
		}

		items = append(items, &item)
	}

	return items, nil
}

func (r *PostgresQuoteRepository) UpdateItem(item *domain.QuoteItem) error {
	query := `
		UPDATE quote_items
		SET product_name = $1, description = $2, weight_grams = $3, print_time_hours = $4,
		    material_cost = $5, labor_cost = $6, electricity_cost = $7, other_costs = $8,
		    subtotal = $9, quantity = $10, unit_price = $11, total = $12
		WHERE id = $13
	`

	_, err := r.db.Exec(context.Background(), query,
		item.ProductName,
		item.Description,
		item.WeightGrams,
		item.PrintTimeHours,
		item.MaterialCost,
		item.LaborCost,
		item.ElectricityCost,
		item.OtherCosts,
		item.Subtotal,
		item.Quantity,
		item.UnitPrice,
		item.Total,
		item.ID,
	)

	return err
}

func (r *PostgresQuoteRepository) DeleteItem(itemID string) error {
	query := `DELETE FROM quote_items WHERE id = $1`
	_, err := r.db.Exec(context.Background(), query, itemID)
	return err
}

func (r *PostgresQuoteRepository) DeleteQuoteItem(ctx context.Context, quoteID, itemID string) error {
	// Use a new context with background to avoid deadline issues
	bgCtx := context.Background()
	query := `DELETE FROM quote_items WHERE id = $1 AND quote_id = $2`
	println("DEBUG REPO: About to execute DELETE with itemID:", itemID, "quoteID:", quoteID)
	result, err := r.db.Exec(bgCtx, query, itemID, quoteID)
	if err != nil {
		println("DEBUG REPO: Exec error:", err.Error())
		return err
	}
	println("DEBUG REPO: Exec completed, rows affected:", result.RowsAffected())
	return nil
}

// GenerateQuoteNumber genera un número de cotización único
func GenerateQuoteNumber() string {
	return fmt.Sprintf("COT-%s", time.Now().Format("20060102150405"))
}
