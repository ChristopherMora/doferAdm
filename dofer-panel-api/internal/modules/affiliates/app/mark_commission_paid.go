package app

import (
	"context"
	"errors"
	"time"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

var ErrCommissionAlreadyPaid = errors.New("affiliate commission already marked as paid")

type MarkCommissionPaidCommand struct {
	CommissionID string
	PaidBy       string
	PaymentNotes string
}

type MarkCommissionPaidHandler struct {
	repo domain.AffiliateRepository
}

func NewMarkCommissionPaidHandler(repo domain.AffiliateRepository) *MarkCommissionPaidHandler {
	return &MarkCommissionPaidHandler{repo: repo}
}

func (h *MarkCommissionPaidHandler) Handle(ctx context.Context, cmd MarkCommissionPaidCommand) (*domain.AffiliateCommission, error) {
	commission, err := h.repo.FindCommissionByID(cmd.CommissionID)
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
	commission.PaymentNotes = cmd.PaymentNotes

	if err := h.repo.UpdateCommission(commission); err != nil {
		return nil, err
	}

	return commission, nil
}
