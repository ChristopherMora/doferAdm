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

type BulkUpdateOrderStatusCommand struct {
	OrderIDs  []string
	NewStatus string
	ChangedBy string
}

type BulkUpdateOrderStatusHandler struct {
	repo        domain.OrderRepository
	historyRepo domain.OrderHistoryRepository
}

func NewBulkUpdateOrderStatusHandler(repo domain.OrderRepository, historyRepo domain.OrderHistoryRepository) *BulkUpdateOrderStatusHandler {
	return &BulkUpdateOrderStatusHandler{
		repo:        repo,
		historyRepo: historyRepo,
	}
}

func (h *BulkUpdateOrderStatusHandler) Handle(ctx context.Context, cmd BulkUpdateOrderStatusCommand) (*BulkUpdateOrdersResult, error) {
	newStatus := strings.TrimSpace(cmd.NewStatus)
	if !isValidOrderStatus(newStatus) {
		return nil, errors.New("invalid status")
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

		oldStatus := string(order.Status)
		if oldStatus == newStatus {
			result.Skipped++
			continue
		}

		if err := order.ChangeStatus(domain.OrderStatus(newStatus)); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, BulkUpdateOrderError{
				OrderID: orderID,
				Error:   err.Error(),
			})
			continue
		}

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
			ChangeType: "bulk_status_change",
			FieldName:  "status",
			OldValue:   oldStatus,
			NewValue:   newStatus,
			CreatedAt:  time.Now(),
		})

		result.Updated++
	}

	return result, nil
}

func isValidOrderStatus(status string) bool {
	switch domain.OrderStatus(status) {
	case domain.StatusNew,
		domain.StatusPrinting,
		domain.StatusPost,
		domain.StatusPacked,
		domain.StatusReady,
		domain.StatusDelivered,
		domain.StatusCancelled:
		return true
	default:
		return false
	}
}
