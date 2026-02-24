package app

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/dofer/panel-api/internal/platform/email"
)

type SendSLARemindersCommand struct {
	HorizonHours int
	DryRun       bool
	TriggeredBy  string
}

type SendSLARemindersResult struct {
	HorizonHours int                    `json:"horizon_hours"`
	DryRun       bool                   `json:"dry_run"`
	Scanned      int                    `json:"scanned"`
	Candidates   int                    `json:"candidates"`
	Risk         int                    `json:"risk"`
	Overdue      int                    `json:"overdue"`
	Notified     int                    `json:"notified"`
	Failed       int                    `json:"failed"`
	Errors       []BulkUpdateOrderError `json:"errors,omitempty"`
}

type SendSLARemindersHandler struct {
	repo        domain.OrderRepository
	historyRepo domain.OrderHistoryRepository
	mailer      email.Mailer
}

func NewSendSLARemindersHandler(repo domain.OrderRepository, historyRepo domain.OrderHistoryRepository, mailer email.Mailer) *SendSLARemindersHandler {
	return &SendSLARemindersHandler{
		repo:        repo,
		historyRepo: historyRepo,
		mailer:      mailer,
	}
}

func (h *SendSLARemindersHandler) Handle(ctx context.Context, cmd SendSLARemindersCommand) (*SendSLARemindersResult, error) {
	horizonHours := cmd.HorizonHours
	if horizonHours <= 0 {
		horizonHours = 24
	}

	scanLimit := 5000
	orders, err := h.repo.FindAll(domain.OrderFilters{
		Limit:  scanLimit,
		Offset: 0,
	})
	if err != nil {
		return nil, err
	}

	frontendURL := strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	frontendURL = strings.TrimRight(frontendURL, "/")

	triggeredBy := strings.TrimSpace(cmd.TriggeredBy)
	if triggeredBy == "" {
		triggeredBy = "system"
	}

	now := time.Now()
	horizon := time.Duration(horizonHours) * time.Hour

	result := &SendSLARemindersResult{
		HorizonHours: horizonHours,
		DryRun:       cmd.DryRun,
	}

	for _, order := range orders {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		result.Scanned++
		if order == nil {
			continue
		}
		if order.Status == domain.StatusDelivered || order.Status == domain.StatusCancelled {
			continue
		}
		if order.DeliveryDeadline == nil {
			continue
		}

		deadline := *order.DeliveryDeadline
		remaining := deadline.Sub(now)
		state := ""

		if remaining < 0 {
			state = "overdue"
			result.Overdue++
		} else if remaining <= horizon {
			state = "risk"
			result.Risk++
		} else {
			continue
		}

		if strings.TrimSpace(order.CustomerEmail) == "" {
			result.Failed++
			result.Errors = append(result.Errors, BulkUpdateOrderError{
				OrderID: order.ID,
				Error:   "missing customer email",
			})
			continue
		}

		result.Candidates++

		if cmd.DryRun {
			continue
		}

		trackingURL := fmt.Sprintf("%s/track/%s", frontendURL, order.PublicID)
		if err := h.mailer.SendOrderSLAReminder(
			order.CustomerEmail,
			order.CustomerName,
			order.OrderNumber,
			deadline,
			state,
			trackingURL,
		); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, BulkUpdateOrderError{
				OrderID: order.ID,
				Error:   err.Error(),
			})
			continue
		}

		result.Notified++

		_ = h.historyRepo.Create(&domain.OrderHistoryEntry{
			OrderID:    order.ID,
			ChangedBy:  triggeredBy,
			ChangeType: "sla_reminder_sent",
			FieldName:  "delivery_deadline",
			OldValue:   deadline.UTC().Format(time.RFC3339),
			NewValue:   state,
			CreatedAt:  time.Now(),
		})
	}

	return result, nil
}
