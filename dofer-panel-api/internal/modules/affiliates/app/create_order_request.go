package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
	"github.com/dofer/panel-api/internal/modules/products"
	"github.com/google/uuid"
)

type CreateOrderRequestCommand struct {
	AffiliateID   string // resuelto SIEMPRE desde el user_id autenticado, nunca del body
	ProductID     string
	ProductName   string
	Quantity      int
	FinalPrice    float64
	CustomerName  string
	CustomerEmail string
	CustomerPhone string
	CustomerNotes string
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

	// Si el afiliado eligió un producto del catálogo, tomamos snapshot de su
	// nombre y precio sugerido al momento de la solicitud (auditoría).
	if cmd.ProductID != "" {
		if productUUID, parseErr := uuid.Parse(cmd.ProductID); parseErr == nil {
			product, err := h.productRepo.GetByID(ctx, organizationIDFromContext(ctx), productUUID)
			if err == nil && product != nil {
				productName = product.Name
				if product.SuggestedPrice != nil {
					suggestedPriceSnapshot = *product.SuggestedPrice
				}
			}
		}
	}

	req, err := domain.NewAffiliateOrderRequest(cmd.AffiliateID, productName, cmd.CustomerName, cmd.Quantity, cmd.FinalPrice)
	if err != nil {
		return nil, err
	}

	req.ProductID = cmd.ProductID
	req.SuggestedPriceSnapshot = suggestedPriceSnapshot
	req.CustomerEmail = cmd.CustomerEmail
	req.CustomerPhone = cmd.CustomerPhone
	req.CustomerNotes = cmd.CustomerNotes

	if err := h.repo.CreateOrderRequest(req); err != nil {
		return nil, err
	}

	return req, nil
}
