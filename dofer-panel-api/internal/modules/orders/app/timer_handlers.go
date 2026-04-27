package app

import (
	"context"
	"errors"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

// StartTimerHandler maneja el inicio del timer de una orden
type StartTimerHandler struct {
	orderRepo domain.OrderRepository
	timerRepo domain.TimerRepository
}

func NewStartTimerHandler(orderRepo domain.OrderRepository, timerRepo domain.TimerRepository) *StartTimerHandler {
	return &StartTimerHandler{
		orderRepo: orderRepo,
		timerRepo: timerRepo,
	}
}

type StartTimerRequest struct {
	OrderID    string  `json:"order_id"`
	OperatorID *string `json:"operator_id"`
}

func (h *StartTimerHandler) Handle(ctx context.Context, req StartTimerRequest) error {
	organizationID := organizationIDFromContext(ctx)

	// Verificar que la orden existe
	order, err := h.orderRepo.FindByID(req.OrderID, organizationID)
	if err != nil {
		return errors.New("order not found")
	}

	// Verificar que el timer no esté ya corriendo
	if order.IsTimerRunning {
		return errors.New("timer is already running")
	}

	// Iniciar el timer
	return h.timerRepo.StartTimer(req.OrderID, organizationID, req.OperatorID)
}

// PauseTimerHandler maneja la pausa del timer
type PauseTimerHandler struct {
	orderRepo domain.OrderRepository
	timerRepo domain.TimerRepository
}

func NewPauseTimerHandler(orderRepo domain.OrderRepository, timerRepo domain.TimerRepository) *PauseTimerHandler {
	return &PauseTimerHandler{
		orderRepo: orderRepo,
		timerRepo: timerRepo,
	}
}

func (h *PauseTimerHandler) Handle(ctx context.Context, orderID string) error {
	organizationID := organizationIDFromContext(ctx)

	// Verificar que la orden existe
	order, err := h.orderRepo.FindByID(orderID, organizationID)
	if err != nil {
		return errors.New("order not found")
	}

	// Verificar que el timer está corriendo
	if !order.IsTimerRunning {
		return errors.New("timer is not running")
	}

	// Pausar el timer
	return h.timerRepo.PauseTimer(orderID, organizationID)
}

// StopTimerHandler maneja la finalización del timer
type StopTimerHandler struct {
	orderRepo domain.OrderRepository
	timerRepo domain.TimerRepository
}

func NewStopTimerHandler(orderRepo domain.OrderRepository, timerRepo domain.TimerRepository) *StopTimerHandler {
	return &StopTimerHandler{
		orderRepo: orderRepo,
		timerRepo: timerRepo,
	}
}

func (h *StopTimerHandler) Handle(ctx context.Context, orderID string) error {
	organizationID := organizationIDFromContext(ctx)

	// Verificar que la orden existe
	_, err := h.orderRepo.FindByID(orderID, organizationID)
	if err != nil {
		return errors.New("order not found")
	}

	// No importa si está corriendo o pausado, se puede detener
	// Detener el timer
	return h.timerRepo.StopTimer(orderID, organizationID)
}

// GetTimerHandler obtiene el estado actual del timer
type GetTimerHandler struct {
	timerRepo domain.TimerRepository
}

func NewGetTimerHandler(timerRepo domain.TimerRepository) *GetTimerHandler {
	return &GetTimerHandler{
		timerRepo: timerRepo,
	}
}

func (h *GetTimerHandler) Handle(ctx context.Context, orderID string) (*domain.TimerState, error) {
	state, err := h.timerRepo.GetTimerState(orderID, organizationIDFromContext(ctx))
	if err != nil {
		return nil, err
	}

	// Recalcular los campos derivados
	state.RefreshCalculations()

	return state, nil
}

// UpdateEstimatedTimeHandler actualiza el tiempo estimado de una orden
type UpdateEstimatedTimeHandler struct {
	timerRepo domain.TimerRepository
}

func NewUpdateEstimatedTimeHandler(timerRepo domain.TimerRepository) *UpdateEstimatedTimeHandler {
	return &UpdateEstimatedTimeHandler{
		timerRepo: timerRepo,
	}
}

type UpdateEstimatedTimeRequest struct {
	OrderID string `json:"order_id"`
	Minutes int    `json:"minutes"`
}

func (h *UpdateEstimatedTimeHandler) Handle(ctx context.Context, req UpdateEstimatedTimeRequest) error {
	if req.Minutes < 0 {
		return errors.New("minutes must be positive")
	}

	return h.timerRepo.UpdateEstimatedTime(req.OrderID, organizationIDFromContext(ctx), req.Minutes)
}

// GetOperatorStatsHandler obtiene estadísticas de rendimiento de operadores
type GetOperatorStatsHandler struct {
	timerRepo domain.TimerRepository
}

func NewGetOperatorStatsHandler(timerRepo domain.TimerRepository) *GetOperatorStatsHandler {
	return &GetOperatorStatsHandler{
		timerRepo: timerRepo,
	}
}

func (h *GetOperatorStatsHandler) HandleSingle(ctx context.Context, operatorID string) (*domain.OperatorStats, error) {
	return h.timerRepo.GetOperatorStats(operatorID, organizationIDFromContext(ctx))
}

func (h *GetOperatorStatsHandler) HandleAll(ctx context.Context) ([]*domain.OperatorStats, error) {
	return h.timerRepo.GetAllOperatorsStats(organizationIDFromContext(ctx))
}
