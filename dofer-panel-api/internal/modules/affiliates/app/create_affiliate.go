package app

import (
	"context"
	"errors"
	"strings"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

var ErrAffiliateEmailRequired = errors.New("affiliate email is required")

type CreateAffiliateCommand struct {
	DisplayName     string
	Email           string
	Phone           string
	CommissionType  domain.CommissionType
	CommissionValue float64
	Notes           string
	CreatedBy       string
}

type CreateAffiliateResult struct {
	Affiliate         *domain.Affiliate
	TemporaryPassword string
}

type CreateAffiliateHandler struct {
	repo        domain.AffiliateRepository
	provisioner domain.AuthUserProvisioner
}

func NewCreateAffiliateHandler(repo domain.AffiliateRepository, provisioner domain.AuthUserProvisioner) *CreateAffiliateHandler {
	return &CreateAffiliateHandler{repo: repo, provisioner: provisioner}
}

func (h *CreateAffiliateHandler) Handle(ctx context.Context, cmd CreateAffiliateCommand) (*CreateAffiliateResult, error) {
	email := strings.TrimSpace(cmd.Email)
	if email == "" {
		return nil, ErrAffiliateEmailRequired
	}
	if strings.TrimSpace(cmd.DisplayName) == "" {
		return nil, errors.New("affiliate display name is required")
	}
	if cmd.CommissionType != domain.CommissionPercentage && cmd.CommissionType != domain.CommissionFixed {
		return nil, errors.New("commission type must be 'percentage' or 'fixed'")
	}
	if cmd.CommissionValue < 0 {
		return nil, errors.New("commission value cannot be negative")
	}

	// 1. Crear el usuario de auth real en Supabase con role=affiliate.
	userID, temporaryPassword, err := h.provisioner.CreateAuthUser(email)
	if err != nil {
		return nil, err
	}

	// 2. Insertar la fila local en users con ese mismo UUID y role='affiliate'
	//    ANTES de que el afiliado inicie sesión por primera vez (ver nota en
	//    infra.PostgresAffiliateRepository.CreateAffiliateUser).
	if err := h.repo.CreateAffiliateUser(userID, email, cmd.DisplayName); err != nil {
		return nil, err
	}

	// 3. Crear el perfil de negocio en affiliates.
	affiliate := &domain.Affiliate{
		UserID:          userID,
		DisplayName:     cmd.DisplayName,
		Email:           email,
		Phone:           cmd.Phone,
		CommissionType:  cmd.CommissionType,
		CommissionValue: cmd.CommissionValue,
		Status:          domain.AffiliateActive,
		Notes:           cmd.Notes,
		CreatedBy:       cmd.CreatedBy,
	}

	if err := h.repo.CreateAffiliate(affiliate); err != nil {
		return nil, err
	}

	return &CreateAffiliateResult{Affiliate: affiliate, TemporaryPassword: temporaryPassword}, nil
}
