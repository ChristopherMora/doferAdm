package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/google/uuid"
)

type BulkUpdateOrderPriorityCommand struct {
	OrderIDs    []string
	NewPriority string
	ChangedBy   string
}

type BulkUpdateOrderPriorityHandler struct {
	repo        domain.OrderRepository
	historyRepo domain.OrderHistoryRepository
}

func NewBulkUpdateOrderPriorityHandler(repo domain.OrderRepository, historyRepo domain.OrderHistoryRepository) *BulkUpdateOrderPriorityHandler {
	return &BulkUpdateOrderPriorityHandler{
		repo:        repo,
		historyRepo: historyRepo,
	}
}

func (h *BulkUpdateOrderPriorityHandler) Handle(ctx context.Context, cmd BulkUpdateOrderPriorityCommand) (*BulkUpdateOrdersResult, error) {
	newPriority := strings.TrimSpace(cmd.NewPriority)
	if !isValidOrderPriority(newPriority) {
		return nil, errors.New("invalid priority")
	}
	if len(cmd.OrderIDs) == 0 {
		return nil, errors.New("order_ids is required")
	}

	batchID := uuid.NewString()
	changedBy := strings.TrimSpace(cmd.ChangedBy)
	if changedBy == "" {
		changedBy = "system"
	}
	changedBy = fmt.Sprintf("%s|batch:%s", changedBy, batchID)

	result := &BulkUpdateOrdersResult{
		BatchID:   batchID,
		Requested: len(cmd.OrderIDs),
	}

	processed := make(map[string]struct{}, len(cmd.OrderIDs))

	for _, orderID := range cmd.OrderIDs {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		orderID = strings.TrimSpace(orderID)
		if orderID == "" {
			result.Failed++
			result.Errors = append(result.Errors, BulkUpdateOrderError{
				OrderID: "",
				Error:   "invalid order id",
			})
			continue
		}
		if _, exists := processed[orderID]; exists {
			result.Skipped++
			continue
		}
		processed[orderID] = struct{}{}

		order, err := h.repo.FindByID(orderID)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, BulkUpdateOrderError{
				OrderID: orderID,
				Error:   ErrOrderNotFound.Error(),
			})
			continue
		}

		oldPriority := string(order.Priority)
		if oldPriority == newPriority {
			result.Skipped++
			continue
		}

		order.Priority = domain.OrderPriority(newPriority)
		order.UpdatedAt = time.Now()

		if err := h.repo.Update(order); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, BulkUpdateOrderError{
				OrderID: orderID,
				Error:   err.Error(),
			})
			continue
		}

		_ = h.historyRepo.Create(&domain.OrderHistoryEntry{
			OrderID:    orderID,
			ChangedBy:  changedBy,
			ChangeType: "bulk_priority_change",
			FieldName:  "priority",
			OldValue:   oldPriority,
			NewValue:   newPriority,
			CreatedAt:  time.Now(),
		})

		result.Updated++
	}

	return result, nil
}

func isValidOrderPriority(priority string) bool {
	switch domain.OrderPriority(priority) {
	case domain.PriorityUrgent, domain.PriorityNormal, domain.PriorityLow:
		return true
	default:
		return false
	}
}
