package app

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/dofer/panel-api/internal/platform/email"
)

type UpdateOrderStatusCommand struct {
	OrderID   string
	NewStatus string
	ChangedBy string
}

type UpdateOrderStatusHandler struct {
	repo        domain.OrderRepository
	historyRepo domain.OrderHistoryRepository
	mailer      email.Mailer
}

func NewUpdateOrderStatusHandler(repo domain.OrderRepository, historyRepo domain.OrderHistoryRepository, mailer email.Mailer) *UpdateOrderStatusHandler {
	return &UpdateOrderStatusHandler{
		repo:        repo,
		historyRepo: historyRepo,
		mailer:      mailer,
	}
}

func (h *UpdateOrderStatusHandler) Handle(ctx context.Context, cmd UpdateOrderStatusCommand) (*domain.Order, error) {
	order, err := h.repo.FindByID(cmd.OrderID)
	if err != nil {
		return nil, ErrOrderNotFound
	}

	oldStatus := string(order.Status)

	if err := order.ChangeStatus(domain.OrderStatus(cmd.NewStatus)); err != nil {
		return nil, err
	}

	if err := h.repo.Update(order); err != nil {
		return nil, err
	}

	// Registrar cambio en el historial
	historyEntry := &domain.OrderHistoryEntry{
		OrderID:    cmd.OrderID,
		ChangedBy:  cmd.ChangedBy,
		ChangeType: "status_change",
		FieldName:  "status",
		OldValue:   oldStatus,
		NewValue:   cmd.NewStatus,
		CreatedAt:  time.Now(),
	}
	h.historyRepo.Create(historyEntry)

	// Enviar notificación por email si el cliente tiene email
	if order.CustomerEmail != "" {
		frontendURL := os.Getenv("FRONTEND_URL")
		if frontendURL == "" {
			frontendURL = "http://localhost:3000"
		}
		trackingURL := fmt.Sprintf("%s/track/%s", frontendURL, order.PublicID)

		go func() {
			err := h.mailer.SendOrderStatusUpdate(
				order.CustomerEmail,
				order.CustomerName,
				order.OrderNumber,
				cmd.NewStatus,
				trackingURL,
			)
			if err != nil {
				fmt.Printf("Error sending email notification: %v\n", err)
			}
		}()
	}

	return order, nil
}
