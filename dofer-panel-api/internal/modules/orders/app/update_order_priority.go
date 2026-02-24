package app

import (
	"context"
	"errors"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type UpdateOrderPriorityCommand struct {
	OrderID     string
	NewPriority string
	ChangedBy   string
}

type UpdateOrderPriorityHandler struct {
	repo        domain.OrderRepository
	historyRepo domain.OrderHistoryRepository
}

func NewUpdateOrderPriorityHandler(repo domain.OrderRepository, historyRepo domain.OrderHistoryRepository) *UpdateOrderPriorityHandler {
	return &UpdateOrderPriorityHandler{
		repo:        repo,
		historyRepo: historyRepo,
	}
}

func (h *UpdateOrderPriorityHandler) Handle(ctx context.Context, cmd UpdateOrderPriorityCommand) (*domain.Order, error) {
	order, err := h.repo.FindByID(cmd.OrderID)
	if err != nil {
		return nil, ErrOrderNotFound
	}

	if cmd.NewPriority != string(domain.PriorityUrgent) &&
		cmd.NewPriority != string(domain.PriorityNormal) &&
		cmd.NewPriority != string(domain.PriorityLow) {
		return nil, errors.New("invalid priority")
	}

	oldPriority := string(order.Priority)
	order.Priority = domain.OrderPriority(cmd.NewPriority)
	order.UpdatedAt = time.Now()

	if err := h.repo.Update(order); err != nil {
		return nil, err
	}

	historyEntry := &domain.OrderHistoryEntry{
		OrderID:    cmd.OrderID,
		ChangedBy:  cmd.ChangedBy,
		ChangeType: "priority_change",
		FieldName:  "priority",
		OldValue:   oldPriority,
		NewValue:   cmd.NewPriority,
		CreatedAt:  time.Now(),
	}
	h.historyRepo.Create(historyEntry)

	return order, nil
}
