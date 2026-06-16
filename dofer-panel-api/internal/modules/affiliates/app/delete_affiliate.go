package app

import (
	"context"
	"errors"
	"strings"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

type DeleteAffiliateCommand struct {
	AffiliateID    string
	OrganizationID string
}

type DeleteAffiliateResult struct {
	Affiliate       *domain.Affiliate
	AuthDeleted     bool
	AuthDeleteError string
}

type DeleteAffiliateHandler struct {
	repo           domain.AffiliateRepository
	accountManager domain.AuthUserAccountManager
}

func NewDeleteAffiliateHandler(repo domain.AffiliateRepository, accountManager domain.AuthUserAccountManager) *DeleteAffiliateHandler {
	return &DeleteAffiliateHandler{repo: repo, accountManager: accountManager}
}

func (h *DeleteAffiliateHandler) Handle(ctx context.Context, cmd DeleteAffiliateCommand) (*DeleteAffiliateResult, error) {
	affiliateID := strings.TrimSpace(cmd.AffiliateID)
	if affiliateID == "" {
		return nil, errors.New("affiliate id is required")
	}

	organizationID := strings.TrimSpace(cmd.OrganizationID)
	if organizationID == "" {
		organizationID = organizationIDFromContext(ctx)
	}
	if organizationID == "" {
		return nil, errors.New("organization id is required")
	}

	affiliate, err := h.repo.DeleteAffiliateIfUnused(affiliateID, organizationID)
	if err != nil {
		return nil, err
	}

	result := &DeleteAffiliateResult{Affiliate: affiliate}
	if err := h.accountManager.DeleteAuthUser(affiliate.UserID); err != nil {
		result.AuthDeleteError = err.Error()
		return result, nil
	}
	result.AuthDeleted = true
	return result, nil
}
