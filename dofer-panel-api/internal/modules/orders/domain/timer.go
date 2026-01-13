package domain

import (
	"errors"
	"time"
)

// Timer errors
var (
	ErrTimerAlreadyRunning = errors.New("timer is already running")
	ErrTimerNotRunning     = errors.New("timer is not running")
)

// TimeEntry representa una sesión de trabajo en una orden
type TimeEntry struct {
	ID           string     `json:"id" db:"id"`
	OrderID      string     `json:"order_id" db:"order_id"`
	OperatorID   *string    `json:"operator_id" db:"operator_id"`
	StartedAt    time.Time  `json:"started_at" db:"started_at"`
	EndedAt      *time.Time `json:"ended_at" db:"ended_at"`
	DurationMins *int       `json:"duration_minutes" db:"duration_minutes"`
	Status       string     `json:"status" db:"status"` // active, paused, completed
	Notes        *string    `json:"notes" db:"notes"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
}

// TimerState representa el estado actual del timer de una orden
type TimerState struct {
	OrderID                string     `json:"order_id"`
	EstimatedTimeMins      int        `json:"estimated_time_minutes"`
	ActualTimeMins         int        `json:"actual_time_minutes"`
	TimerStartedAt         *time.Time `json:"timer_started_at"`
	TimerPausedAt          *time.Time `json:"timer_paused_at"`
	IsTimerRunning         bool       `json:"is_timer_running"`
	TimerTotalPausedMins   int        `json:"timer_total_paused_minutes"`
	CurrentSessionMins     int        `json:"current_session_minutes"`
	PercentageComplete     float64    `json:"percentage_complete"`
	EstimatedTimeRemaining int        `json:"estimated_time_remaining"`
}

// OperatorStats representa las estadísticas de rendimiento de un operador
type OperatorStats struct {
	OperatorID        string  `json:"operator_id"`
	OperatorName      string  `json:"operator_name"`
	TotalOrders       int     `json:"total_orders"`
	CompletedOrders   int     `json:"completed_orders"`
	TotalTimeMins     int     `json:"total_time_minutes"`
	AvgTimeMins       float64 `json:"avg_time_minutes"`
	EstimatedVsActual float64 `json:"estimated_vs_actual"` // Porcentaje: actual/estimated * 100
	Efficiency        string  `json:"efficiency"`          // "fast", "average", "slow"
}

// TimerRepository define métodos para gestión de timers
type TimerRepository interface {
	// StartTimer inicia el timer de una orden
	StartTimer(orderID string, operatorID *string) error

	// PauseTimer pausa el timer actual
	PauseTimer(orderID string) error

	// StopTimer detiene y completa el timer
	StopTimer(orderID string) error

	// GetTimerState obtiene el estado actual del timer
	GetTimerState(orderID string) (*TimerState, error)

	// CreateTimeEntry crea una entrada de tiempo
	CreateTimeEntry(entry *TimeEntry) error

	// GetTimeEntries obtiene todas las entradas de una orden
	GetTimeEntries(orderID string) ([]*TimeEntry, error)

	// GetOperatorStats obtiene estadísticas de un operador
	GetOperatorStats(operatorID string) (*OperatorStats, error)

	// GetAllOperatorsStats obtiene estadísticas de todos los operadores
	GetAllOperatorsStats() ([]*OperatorStats, error)

	// UpdateEstimatedTime actualiza el tiempo estimado de una orden
	UpdateEstimatedTime(orderID string, minutes int) error
}

// CalculateCurrentSessionMinutes calcula los minutos de la sesión actual
func (t *TimerState) CalculateCurrentSessionMinutes() int {
	if t.TimerStartedAt == nil {
		return 0
	}

	var endTime time.Time
	if t.IsTimerRunning {
		endTime = time.Now()
	} else if t.TimerPausedAt != nil {
		endTime = *t.TimerPausedAt
	} else {
		return 0
	}

	duration := endTime.Sub(*t.TimerStartedAt)
	return int(duration.Minutes())
}

// CalculatePercentageComplete calcula el porcentaje completado
func (t *TimerState) CalculatePercentageComplete() float64 {
	if t.EstimatedTimeMins == 0 {
		return 0
	}

	totalMins := t.ActualTimeMins + t.CurrentSessionMins
	return (float64(totalMins) / float64(t.EstimatedTimeMins)) * 100
}

// CalculateEstimatedTimeRemaining calcula el tiempo restante estimado
func (t *TimerState) CalculateEstimatedTimeRemaining() int {
	totalMins := t.ActualTimeMins + t.CurrentSessionMins
	remaining := t.EstimatedTimeMins - totalMins
	if remaining < 0 {
		return 0
	}
	return remaining
}

// RefreshCalculations recalcula todos los campos derivados
func (t *TimerState) RefreshCalculations() {
	t.CurrentSessionMins = t.CalculateCurrentSessionMinutes()
	t.PercentageComplete = t.CalculatePercentageComplete()
	t.EstimatedTimeRemaining = t.CalculateEstimatedTimeRemaining()
}
