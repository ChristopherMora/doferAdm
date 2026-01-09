package app

import (
	"context"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
)

type AssignOrderCommand struct {
	OrderID   string
	UserID    string
	ChangedBy string
}

type AssignOrderHandler struct {
	repo        domain.OrderRepository
	historyRepo domain.OrderHistoryRepository
}

func NewAssignOrderHandler(repo domain.OrderRepository, historyRepo domain.OrderHistoryRepository) *AssignOrderHandler {
	return &AssignOrderHandler{
		repo:        repo,
		historyRepo: historyRepo,
	}
}

func (h *AssignOrderHandler) Handle(ctx context.Context, cmd AssignOrderCommand) (*domain.Order, error) {
	order, err := h.repo.FindByID(cmd.OrderID)
	if err != nil {
		return nil, ErrOrderNotFound
	}

	oldAssigned := order.AssignedTo

	order.AssignTo(cmd.UserID)

	if err := h.repo.Update(order); err != nil {
		return nil, err
	}

	// Registrar cambio en el historial
	historyEntry := &domain.OrderHistoryEntry{
		OrderID:    cmd.OrderID,
		ChangedBy:  cmd.ChangedBy,
		ChangeType: "assignment",
		FieldName:  "assigned_to",
		OldValue:   oldAssigned,
		NewValue:   cmd.UserID,
		CreatedAt:  time.Now(),
	}
	h.historyRepo.Create(historyEntry)

	return order, nil
}
