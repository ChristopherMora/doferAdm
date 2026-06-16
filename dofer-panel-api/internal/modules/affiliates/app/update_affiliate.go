package app

import (
	"context"
	"errors"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

type UpdateAffiliateCommand struct {
	AffiliateID     string
	DisplayName     *string
	Phone           *string
	CommissionType  *domain.CommissionType
	CommissionValue *float64
	Status          *domain.AffiliateStatus
	Notes           *string
}

type UpdateAffiliateHandler struct {
	repo domain.AffiliateRepository
}

func NewUpdateAffiliateHandler(repo domain.AffiliateRepository) *UpdateAffiliateHandler {
	return &UpdateAffiliateHandler{repo: repo}
}

func (h *UpdateAffiliateHandler) Handle(ctx context.Context, cmd UpdateAffiliateCommand) (*domain.Affiliate, error) {
	affiliate, err := h.repo.FindAffiliateByID(cmd.AffiliateID)
	if err != nil {
		return nil, err
	}

	if cmd.DisplayName != nil {
		affiliate.DisplayName = *cmd.DisplayName
	}
	if cmd.Phone != nil {
		affiliate.Phone = *cmd.Phone
	}
	if cmd.CommissionType != nil {
		if *cmd.CommissionType != domain.CommissionPercentage && *cmd.CommissionType != domain.CommissionFixed {
			return nil, errors.New("commission type must be 'percentage' or 'fixed'")
		}
		affiliate.CommissionType = *cmd.CommissionType
	}
	if cmd.CommissionValue != nil {
		if *cmd.CommissionValue < 0 {
			return nil, errors.New("commission value cannot be negative")
		}
		affiliate.CommissionValue = *cmd.CommissionValue
	}
	if cmd.Status != nil {
		if *cmd.Status != domain.AffiliateActive && *cmd.Status != domain.AffiliateSuspended {
			return nil, errors.New("status must be 'active' or 'suspended'")
		}
		affiliate.Status = *cmd.Status
	}
	if cmd.Notes != nil {
		affiliate.Notes = *cmd.Notes
	}

	if err := h.repo.UpdateAffiliate(affiliate); err != nil {
		return nil, err
	}

	return affiliate, nil
}
