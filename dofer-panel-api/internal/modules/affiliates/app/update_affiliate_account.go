package app

import (
	"context"
	"errors"
	"net/mail"
	"strings"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

type UpdateAffiliateEmailCommand struct {
	AffiliateID    string
	OrganizationID string
	Email          string
}

type ResetAffiliatePasswordCommand struct {
	AffiliateID    string
	OrganizationID string
}

type ResetAffiliatePasswordResult struct {
	Affiliate         *domain.Affiliate
	TemporaryPassword string
}

type UpdateAffiliateAccountHandler struct {
	repo           domain.AffiliateRepository
	accountManager domain.AuthUserAccountManager
}

func NewUpdateAffiliateAccountHandler(repo domain.AffiliateRepository, accountManager domain.AuthUserAccountManager) *UpdateAffiliateAccountHandler {
	return &UpdateAffiliateAccountHandler{repo: repo, accountManager: accountManager}
}

func (h *UpdateAffiliateAccountHandler) UpdateEmail(ctx context.Context, cmd UpdateAffiliateEmailCommand) (*domain.Affiliate, error) {
	affiliateID := strings.TrimSpace(cmd.AffiliateID)
	if affiliateID == "" {
		return nil, errors.New("affiliate id is required")
	}

	email := strings.ToLower(strings.TrimSpace(cmd.Email))
	if email == "" {
		return nil, ErrAffiliateEmailRequired
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return nil, errors.New("affiliate email is invalid")
	}

	organizationID := strings.TrimSpace(cmd.OrganizationID)
	if organizationID == "" {
		organizationID = organizationIDFromContext(ctx)
	}
	if organizationID == "" {
		return nil, errors.New("organization id is required")
	}

	affiliate, err := h.repo.FindAffiliateByID(affiliateID, organizationID)
	if err != nil {
		return nil, err
	}
	if strings.EqualFold(affiliate.Email, email) {
		return affiliate, nil
	}

	if err := h.accountManager.UpdateAuthUserEmail(affiliate.UserID, email); err != nil {
		return nil, err
	}

	return h.repo.UpdateAffiliateAccountEmail(affiliate.ID, organizationID, email)
}

func (h *UpdateAffiliateAccountHandler) ResetPassword(ctx context.Context, cmd ResetAffiliatePasswordCommand) (*ResetAffiliatePasswordResult, error) {
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

	affiliate, err := h.repo.FindAffiliateByID(affiliateID, organizationID)
	if err != nil {
		return nil, err
	}

	temporaryPassword, err := h.accountManager.ResetAuthUserPassword(affiliate.UserID)
	if err != nil {
		return nil, err
	}

	return &ResetAffiliatePasswordResult{Affiliate: affiliate, TemporaryPassword: temporaryPassword}, nil
}
