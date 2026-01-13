package infra

import (
	"context"
	"database/sql"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresTimerRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresTimerRepository(pool *pgxpool.Pool) *PostgresTimerRepository {
	return &PostgresTimerRepository{pool: pool}
}

// StartTimer inicia el timer de una orden
func (r *PostgresTimerRepository) StartTimer(orderID string, operatorID *string) error {
	ctx := context.Background()
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	now := time.Now()

	// Verificar que el timer no esté corriendo directamente desde la BD
	var isRunning bool
	checkQuery := `SELECT COALESCE(is_timer_running, false) FROM orders WHERE id = $1`
	err = tx.QueryRow(ctx, checkQuery, orderID).Scan(&isRunning)
	if err != nil {
		return err
	}
	
	if isRunning {
		return domain.ErrTimerAlreadyRunning
	}

	// Actualizar la orden
	query := `
		UPDATE orders 
		SET timer_started_at = $1,
		    is_timer_running = true,
		    timer_paused_at = NULL,
		    updated_at = $1
		WHERE id = $2
	`
	_, err = tx.Exec(ctx, query, now, orderID)
	if err != nil {
		return err
	}

	// Crear entrada de tiempo
	entryQuery := `
		INSERT INTO order_time_entries (order_id, operator_id, started_at, status)
		VALUES ($1, $2, $3, 'active')
	`
	_, err = tx.Exec(ctx, entryQuery, orderID, operatorID, now)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// PauseTimer pausa el timer actual
func (r *PostgresTimerRepository) PauseTimer(orderID string) error {
	ctx := context.Background()
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	now := time.Now()

	// Obtener datos actuales del timer
	var startedAt time.Time
	var totalPaused int
	query := `
		SELECT timer_started_at, COALESCE(timer_total_paused_minutes, 0)
		FROM orders 
		WHERE id = $1
	`
	err = tx.QueryRow(ctx, query, orderID).Scan(&startedAt, &totalPaused)
	if err != nil {
		return err
	}

	// Calcular minutos de esta sesión
	sessionMins := int(now.Sub(startedAt).Minutes())

	// Actualizar la orden
	updateQuery := `
		UPDATE orders 
		SET timer_paused_at = $1,
		    is_timer_running = false,
		    actual_time_minutes = actual_time_minutes + $2,
		    updated_at = $1
		WHERE id = $3
	`
	_, err = tx.Exec(ctx, updateQuery, now, sessionMins, orderID)
	if err != nil {
		return err
	}

	// Actualizar la entrada de tiempo activa
	entryQuery := `
		UPDATE order_time_entries
		SET ended_at = $1,
		    duration_minutes = $2,
		    status = 'paused'
		WHERE order_id = $3 AND status = 'active'
	`
	_, err = tx.Exec(ctx, entryQuery, now, sessionMins, orderID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// StopTimer detiene y completa el timer
func (r *PostgresTimerRepository) StopTimer(orderID string) error {
	ctx := context.Background()
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	now := time.Now()

	// Obtener datos actuales
	var startedAt sql.NullTime
	var isRunning bool
	query := `
		SELECT timer_started_at, is_timer_running
		FROM orders 
		WHERE id = $1
	`
	err = tx.QueryRow(ctx, query, orderID).Scan(&startedAt, &isRunning)
	if err != nil {
		return err
	}

	// Si está corriendo, calcular y agregar tiempo de sesión actual
	var sessionMins int
	if isRunning && startedAt.Valid {
		sessionMins = int(now.Sub(startedAt.Time).Minutes())

		updateQuery := `
			UPDATE orders 
			SET actual_time_minutes = actual_time_minutes + $1,
			    is_timer_running = false,
			    timer_started_at = NULL,
			    timer_paused_at = NULL,
			    updated_at = $2
			WHERE id = $3
		`
		_, err = tx.Exec(ctx, updateQuery, sessionMins, now, orderID)
		if err != nil {
			return err
		}

		// Actualizar entrada activa
		entryQuery := `
			UPDATE order_time_entries
			SET ended_at = $1,
			    duration_minutes = $2,
			    status = 'completed'
			WHERE order_id = $3 AND status = 'active'
		`
		_, err = tx.Exec(ctx, entryQuery, now, sessionMins, orderID)
		if err != nil {
			return err
		}
	} else {
		// Solo resetear el timer
		updateQuery := `
			UPDATE orders 
			SET is_timer_running = false,
			    timer_started_at = NULL,
			    timer_paused_at = NULL,
			    updated_at = $1
			WHERE id = $2
		`
		_, err = tx.Exec(ctx, updateQuery, now, orderID)
		if err != nil {
			return err
		}
	}

	// Marcar todas las entradas pausadas como completadas
	completeQuery := `
		UPDATE order_time_entries
		SET status = 'completed'
		WHERE order_id = $1 AND status = 'paused'
	`
	_, err = tx.Exec(ctx, completeQuery, orderID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// GetTimerState obtiene el estado actual del timer
func (r *PostgresTimerRepository) GetTimerState(orderID string) (*domain.TimerState, error) {
	ctx := context.Background()

	query := `
		SELECT 
			id,
			COALESCE(estimated_time_minutes, 0),
			COALESCE(actual_time_minutes, 0),
			timer_started_at,
			timer_paused_at,
			COALESCE(is_timer_running, false),
			COALESCE(timer_total_paused_minutes, 0)
		FROM orders 
		WHERE id = $1
	`

	var id string
	var estimatedMins, actualMins, totalPausedMins int
	var startedAt, pausedAt sql.NullTime
	var isRunning bool

	err := r.pool.QueryRow(ctx, query, orderID).Scan(
		&id,
		&estimatedMins,
		&actualMins,
		&startedAt,
		&pausedAt,
		&isRunning,
		&totalPausedMins,
	)
	if err != nil {
		return nil, err
	}

	state := &domain.TimerState{
		OrderID:              id,
		EstimatedTimeMins:    estimatedMins,
		ActualTimeMins:       actualMins,
		IsTimerRunning:       isRunning,
		TimerTotalPausedMins: totalPausedMins,
	}

	if startedAt.Valid {
		state.TimerStartedAt = &startedAt.Time
	}
	if pausedAt.Valid {
		state.TimerPausedAt = &pausedAt.Time
	}

	return state, nil
}

// CreateTimeEntry crea una entrada de tiempo
func (r *PostgresTimerRepository) CreateTimeEntry(entry *domain.TimeEntry) error {
	ctx := context.Background()

	query := `
		INSERT INTO order_time_entries 
		(order_id, operator_id, started_at, ended_at, duration_minutes, status, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := r.pool.Exec(ctx, query,
		entry.OrderID,
		entry.OperatorID,
		entry.StartedAt,
		entry.EndedAt,
		entry.DurationMins,
		entry.Status,
		entry.Notes,
	)

	return err
}

// GetTimeEntries obtiene todas las entradas de una orden
func (r *PostgresTimerRepository) GetTimeEntries(orderID string) ([]*domain.TimeEntry, error) {
	ctx := context.Background()

	query := `
		SELECT id, order_id, operator_id, started_at, ended_at, 
		       duration_minutes, status, notes, created_at
		FROM order_time_entries
		WHERE order_id = $1
		ORDER BY started_at DESC
	`

	rows, err := r.pool.Query(ctx, query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*domain.TimeEntry
	for rows.Next() {
		var entry domain.TimeEntry
		var operatorID, notes sql.NullString
		var endedAt sql.NullTime
		var durationMins sql.NullInt32

		err := rows.Scan(
			&entry.ID,
			&entry.OrderID,
			&operatorID,
			&entry.StartedAt,
			&endedAt,
			&durationMins,
			&entry.Status,
			&notes,
			&entry.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if operatorID.Valid {
			entry.OperatorID = &operatorID.String
		}
		if endedAt.Valid {
			entry.EndedAt = &endedAt.Time
		}
		if durationMins.Valid {
			mins := int(durationMins.Int32)
			entry.DurationMins = &mins
		}
		if notes.Valid {
			entry.Notes = &notes.String
		}

		entries = append(entries, &entry)
	}

	return entries, nil
}

// GetOperatorStats obtiene estadísticas de un operador
func (r *PostgresTimerRepository) GetOperatorStats(operatorID string) (*domain.OperatorStats, error) {
	ctx := context.Background()

	query := `
		SELECT 
			u.id,
			u.full_name,
			COUNT(DISTINCT o.id) as total_orders,
			COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as completed_orders,
			COALESCE(SUM(o.actual_time_minutes), 0) as total_time_minutes,
			COALESCE(AVG(o.actual_time_minutes), 0) as avg_time_minutes,
			CASE 
				WHEN SUM(o.estimated_time_minutes) > 0 THEN
					(SUM(o.actual_time_minutes)::float / SUM(o.estimated_time_minutes)::float) * 100
				ELSE 0
			END as estimated_vs_actual
		FROM users u
		LEFT JOIN orders o ON o.assigned_to = u.id
		WHERE u.id = $1
		GROUP BY u.id, u.full_name
	`

	var stats domain.OperatorStats
	err := r.pool.QueryRow(ctx, query, operatorID).Scan(
		&stats.OperatorID,
		&stats.OperatorName,
		&stats.TotalOrders,
		&stats.CompletedOrders,
		&stats.TotalTimeMins,
		&stats.AvgTimeMins,
		&stats.EstimatedVsActual,
	)
	if err != nil {
		return nil, err
	}

	// Determinar eficiencia
	if stats.EstimatedVsActual <= 90 {
		stats.Efficiency = "fast"
	} else if stats.EstimatedVsActual <= 110 {
		stats.Efficiency = "average"
	} else {
		stats.Efficiency = "slow"
	}

	return &stats, nil
}

// GetAllOperatorsStats obtiene estadísticas de todos los operadores
func (r *PostgresTimerRepository) GetAllOperatorsStats() ([]*domain.OperatorStats, error) {
	ctx := context.Background()

	query := `
		SELECT 
			u.id,
			u.full_name,
			COUNT(DISTINCT o.id) as total_orders,
			COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as completed_orders,
			COALESCE(SUM(o.actual_time_minutes), 0) as total_time_minutes,
			COALESCE(AVG(o.actual_time_minutes), 0) as avg_time_minutes,
			CASE 
				WHEN SUM(o.estimated_time_minutes) > 0 THEN
					(SUM(o.actual_time_minutes)::float / SUM(o.estimated_time_minutes)::float) * 100
				ELSE 0
			END as estimated_vs_actual
		FROM users u
		LEFT JOIN orders o ON o.assigned_to = u.id
		WHERE u.role IN ('admin', 'operator')
		GROUP BY u.id, u.full_name
		HAVING COUNT(DISTINCT o.id) > 0
		ORDER BY total_orders DESC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var allStats []*domain.OperatorStats
	for rows.Next() {
		var stats domain.OperatorStats
		err := rows.Scan(
			&stats.OperatorID,
			&stats.OperatorName,
			&stats.TotalOrders,
			&stats.CompletedOrders,
			&stats.TotalTimeMins,
			&stats.AvgTimeMins,
			&stats.EstimatedVsActual,
		)
		if err != nil {
			return nil, err
		}

		// Determinar eficiencia
		if stats.EstimatedVsActual <= 90 {
			stats.Efficiency = "fast"
		} else if stats.EstimatedVsActual <= 110 {
			stats.Efficiency = "average"
		} else {
			stats.Efficiency = "slow"
		}

		allStats = append(allStats, &stats)
	}

	return allStats, nil
}

// UpdateEstimatedTime actualiza el tiempo estimado de una orden
func (r *PostgresTimerRepository) UpdateEstimatedTime(orderID string, minutes int) error {
	ctx := context.Background()

	query := `
		UPDATE orders 
		SET estimated_time_minutes = $1,
		    updated_at = $2
		WHERE id = $3
	`

	_, err := r.pool.Exec(ctx, query, minutes, time.Now(), orderID)
	return err
}
