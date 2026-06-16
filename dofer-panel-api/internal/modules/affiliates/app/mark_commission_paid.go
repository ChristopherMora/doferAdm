package app

import (
	"context"
	"errors"
	"time"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
	"github.com/google/uuid"
)

var ErrCommissionAlreadyPaid = errors.New("affiliate commission already marked as paid")

type MarkCommissionPaidCommand struct {
	CommissionID     string
	PaidBy           string
	PaymentMethod    string
	PaymentReference string
	PaymentNotes     string
}

type MarkCommissionPaidHandler struct {
	repo domain.AffiliateRepository
}

func NewMarkCommissionPaidHandler(repo domain.AffiliateRepository) *MarkCommissionPaidHandler {
	return &MarkCommissionPaidHandler{repo: repo}
}

func (h *MarkCommissionPaidHandler) Handle(ctx context.Context, cmd MarkCommissionPaidCommand) (*domain.AffiliateCommission, error) {
	commission, err := h.repo.FindCommissionByID(cmd.CommissionID, organizationIDFromContext(ctx))
	if err != nil {
		return nil, err
	}

	if commission.Status == domain.CommissionPaid {
		return nil, ErrCommissionAlreadyPaid
	}

	now := time.Now()
	commission.Status = domain.CommissionPaid
	commission.PaidAt = &now
	commission.PaidBy = cmd.PaidBy
	commission.PaidBatchID = uuid.NewString()
	commission.PaymentMethod = cmd.PaymentMethod
	commission.PaymentReference = cmd.PaymentReference
	commission.PaymentNotes = cmd.PaymentNotes

	if err := h.repo.UpdateCommission(commission); err != nil {
		return nil, err
	}

	return commission, nil
}

type MarkCommissionsPaidBatchCommand struct {
	CommissionIDs    []string
	PaidBy           string
	PaymentMethod    string
	PaymentReference string
	PaymentNotes     string
}

func (h *MarkCommissionPaidHandler) HandleBatch(ctx context.Context, cmd MarkCommissionsPaidBatchCommand) ([]*domain.AffiliateCommission, error) {
	if len(cmd.CommissionIDs) == 0 {
		return nil, errors.New("commission ids are required")
	}

	batchID := uuid.NewString()
	now := time.Now()
	paid := make([]*domain.AffiliateCommission, 0, len(cmd.CommissionIDs))
	for _, commissionID := range cmd.CommissionIDs {
		commission, err := h.repo.FindCommissionByID(commissionID, organizationIDFromContext(ctx))
		if err != nil {
			return nil, err
		}
		if commission.Status == domain.CommissionPaid {
			return nil, ErrCommissionAlreadyPaid
		}

		commission.Status = domain.CommissionPaid
		commission.PaidAt = &now
		commission.PaidBy = cmd.PaidBy
		commission.PaidBatchID = batchID
		commission.PaymentMethod = cmd.PaymentMethod
		commission.PaymentReference = cmd.PaymentReference
		commission.PaymentNotes = cmd.PaymentNotes

		if err := h.repo.UpdateCommission(commission); err != nil {
			return nil, err
		}
		paid = append(paid, commission)
	}

	return paid, nil
}
