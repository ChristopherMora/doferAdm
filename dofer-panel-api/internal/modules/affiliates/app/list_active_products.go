package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/products"
)

// ListActiveProductsForAffiliateHandler expone una lectura de productos
// activos para el portal de afiliados, sin abrir el módulo /products (que
// queda exclusivamente para admin/operator/viewer) al rol "affiliate".
type ListActiveProductsForAffiliateHandler struct {
	productRepo *products.Repository
}

func NewListActiveProductsForAffiliateHandler(productRepo *products.Repository) *ListActiveProductsForAffiliateHandler {
	return &ListActiveProductsForAffiliateHandler{productRepo: productRepo}
}

func (h *ListActiveProductsForAffiliateHandler) Handle(ctx context.Context) ([]products.Product, error) {
	active := true
	return h.productRepo.List(ctx, organizationIDFromContext(ctx), "", &active, 200, 0)
}
