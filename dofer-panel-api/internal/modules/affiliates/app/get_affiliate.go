package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

type GetAffiliateHandler struct {
	repo domain.AffiliateRepository
}

func NewGetAffiliateHandler(repo domain.AffiliateRepository) *GetAffiliateHandler {
	return &GetAffiliateHandler{repo: repo}
}

func (h *GetAffiliateHandler) Handle(ctx context.Context, id string) (*domain.Affiliate, error) {
	return h.repo.FindAffiliateByID(id)
}

// GetAffiliateByUserIDHandler resuelve el afiliado a partir del user_id
// autenticado (nunca confiar en un affiliate_id enviado por el cliente).
type GetAffiliateByUserIDHandler struct {
	repo domain.AffiliateRepository
}

func NewGetAffiliateByUserIDHandler(repo domain.AffiliateRepository) *GetAffiliateByUserIDHandler {
	return &GetAffiliateByUserIDHandler{repo: repo}
}

func (h *GetAffiliateByUserIDHandler) Handle(ctx context.Context, userID string) (*domain.Affiliate, error) {
	return h.repo.FindAffiliateByUserID(userID)
}
