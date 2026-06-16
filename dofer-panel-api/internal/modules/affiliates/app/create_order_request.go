package app

import (
	"context"
	"errors"
	"strings"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
	"github.com/dofer/panel-api/internal/modules/products"
	"github.com/google/uuid"
)

type CreateOrderRequestCommand struct {
	OrganizationID  string
	AffiliateID     string // resuelto SIEMPRE desde el user_id autenticado, nunca del body
	ProductID       string
	ProductName     string
	Quantity        int
	FinalPrice      float64
	Priority        string
	ReferenceImages []string
	CustomerName    string
	CustomerEmail   string
	CustomerPhone   string
	CustomerNotes   string
}

type CreateOrderRequestHandler struct {
	repo        domain.AffiliateRepository
	productRepo *products.Repository
}

func NewCreateOrderRequestHandler(repo domain.AffiliateRepository, productRepo *products.Repository) *CreateOrderRequestHandler {
	return &CreateOrderRequestHandler{repo: repo, productRepo: productRepo}
}

func (h *CreateOrderRequestHandler) Handle(ctx context.Context, cmd CreateOrderRequestCommand) (*domain.AffiliateOrderRequest, error) {
	productName := cmd.ProductName
	var suggestedPriceSnapshot float64
	var minPriceSnapshot float64
	organizationID := strings.TrimSpace(cmd.OrganizationID)
	if organizationID == "" {
		organizationID = organizationIDFromContext(ctx)
	}
	if organizationID == "" {
		return nil, errors.New("organization id is required")
	}
	priority := normalizePriority(cmd.Priority)

	// Si el afiliado eligió un producto del catálogo, tomamos snapshot de su
	// nombre y precio sugerido al momento de la solicitud (auditoría).
	if cmd.ProductID != "" {
		if productUUID, parseErr := uuid.Parse(cmd.ProductID); parseErr == nil {
			product, err := h.productRepo.GetByID(ctx, organizationID, productUUID)
			if err == nil && product != nil {
				if !product.AffiliateVisible || !product.IsActive {
					return nil, errors.New("product is not available for affiliates")
				}
				productName = product.Name
				if product.SuggestedPrice != nil {
					suggestedPriceSnapshot = *product.SuggestedPrice
				}
				if product.AffiliateMinPrice != nil {
					minPriceSnapshot = *product.AffiliateMinPrice
				}
			}
		}
	}
	if minPriceSnapshot > 0 && cmd.FinalPrice < minPriceSnapshot {
		return nil, errors.New("final price is below the affiliate minimum price")
	}

	req, err := domain.NewAffiliateOrderRequest(cmd.AffiliateID, productName, cmd.CustomerName, cmd.Quantity, cmd.FinalPrice)
	if err != nil {
		return nil, err
	}

	req.OrganizationID = organizationID
	req.ProductID = cmd.ProductID
	req.SuggestedPriceSnapshot = suggestedPriceSnapshot
	req.MinPriceSnapshot = minPriceSnapshot
	req.Priority = priority
	req.ReferenceImages = sanitizeReferenceImages(cmd.ReferenceImages)
	req.CustomerEmail = cmd.CustomerEmail
	req.CustomerPhone = cmd.CustomerPhone
	req.CustomerNotes = cmd.CustomerNotes

	if err := h.repo.CreateOrderRequest(req); err != nil {
		return nil, err
	}

	return req, nil
}

func normalizePriority(priority string) string {
	switch strings.ToLower(strings.TrimSpace(priority)) {
	case "urgent", "low":
		return strings.ToLower(strings.TrimSpace(priority))
	default:
		return "normal"
	}
}

func sanitizeReferenceImages(images []string) []string {
	const maxImages = 6
	result := make([]string, 0, len(images))
	for _, image := range images {
		trimmed := strings.TrimSpace(image)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
		if len(result) == maxImages {
			break
		}
	}
	return result
}
