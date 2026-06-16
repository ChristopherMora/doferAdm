package app

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
	"github.com/google/uuid"
)

var ErrAffiliateEmailRequired = errors.New("affiliate email is required")

type CreateAffiliateCommand struct {
	OrganizationID     string
	DisplayName        string
	Email              string
	Phone              string
	ReferralCode       string
	CommissionType     domain.CommissionType
	CommissionValue    float64
	MaxPendingRequests int
	AllowUrgentOrders  *bool
	Notes              string
	CreatedBy          string
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
	if cmd.MaxPendingRequests < 0 {
		return nil, errors.New("max pending requests cannot be negative")
	}
	organizationID := strings.TrimSpace(cmd.OrganizationID)
	if organizationID == "" {
		organizationID = organizationIDFromContext(ctx)
	}
	if organizationID == "" {
		return nil, errors.New("organization id is required")
	}

	// 1. Crear el usuario de auth real en Supabase con role=affiliate.
	userID, temporaryPassword, err := h.provisioner.CreateAuthUser(email)
	if err != nil {
		return nil, err
	}

	// 2. Insertar la fila local en users con ese mismo UUID y role='affiliate'
	//    ANTES de que el afiliado inicie sesión por primera vez (ver nota en
	//    infra.PostgresAffiliateRepository.CreateAffiliateUser).
	if err := h.repo.CreateAffiliateUser(userID, email, cmd.DisplayName, organizationID); err != nil {
		return nil, err
	}

	// 3. Crear el perfil de negocio en affiliates.
	affiliate := &domain.Affiliate{
		OrganizationID:     organizationID,
		UserID:             userID,
		ReferralCode:       normalizeReferralCode(cmd.ReferralCode, cmd.DisplayName),
		DisplayName:        cmd.DisplayName,
		Email:              email,
		Phone:              cmd.Phone,
		CommissionType:     cmd.CommissionType,
		CommissionValue:    cmd.CommissionValue,
		MaxPendingRequests: cmd.MaxPendingRequests,
		AllowUrgentOrders:  true,
		Status:             domain.AffiliateActive,
		Notes:              cmd.Notes,
		CreatedBy:          cmd.CreatedBy,
	}
	if cmd.AllowUrgentOrders != nil {
		affiliate.AllowUrgentOrders = *cmd.AllowUrgentOrders
	}

	if err := h.repo.CreateAffiliate(affiliate); err != nil {
		return nil, err
	}

	return &CreateAffiliateResult{Affiliate: affiliate, TemporaryPassword: temporaryPassword}, nil
}

func normalizeReferralCode(code, fallback string) string {
	normalized := strings.ToLower(strings.TrimSpace(code))
	hasExplicitCode := normalized != ""
	if normalized == "" {
		normalized = strings.ToLower(strings.TrimSpace(fallback))
	}
	normalized = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(normalized, "-")
	normalized = strings.Trim(normalized, "-")
	if normalized == "" {
		normalized = "afiliado"
	}
	if hasExplicitCode {
		return normalized
	}
	return normalized + "-" + strings.ToLower(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
}
