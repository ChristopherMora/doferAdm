package app

import (
	"context"
	"fmt"
	"time"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
	ordersDomain "github.com/dofer/panel-api/internal/modules/orders/domain"
)

type ApproveOrderRequestCommand struct {
	RequestID  string
	ReviewedBy string
}

type ApproveOrderRequestResult struct {
	Order      *ordersDomain.Order
	Commission *domain.AffiliateCommission
}

// ApproveOrderRequestHandler replica el patrón de
// quotes/app/convert_to_order.go: convierte una solicitud de afiliado
// aprobada en una orden real del pipeline de producción, y genera la
// comisión pendiente correspondiente.
type ApproveOrderRequestHandler struct {
	repo      domain.AffiliateRepository
	orderRepo ordersDomain.OrderRepository
}

func NewApproveOrderRequestHandler(repo domain.AffiliateRepository, orderRepo ordersDomain.OrderRepository) *ApproveOrderRequestHandler {
	return &ApproveOrderRequestHandler{repo: repo, orderRepo: orderRepo}
}

func (h *ApproveOrderRequestHandler) Handle(ctx context.Context, cmd ApproveOrderRequestCommand) (*ApproveOrderRequestResult, error) {
	organizationID := organizationIDFromContext(ctx)
	req, err := h.repo.FindOrderRequestByID(cmd.RequestID, organizationID)
	if err != nil {
		return nil, err
	}

	if req.Status != domain.RequestPending {
		return nil, domain.ErrRequestNotPending
	}

	affiliate, err := h.repo.FindAffiliateByID(req.AffiliateID, organizationID)
	if err != nil {
		return nil, err
	}

	// 1. Crear la orden real, igual que convert_to_order.go hace para quotes.
	orderNumber := fmt.Sprintf("AFF-%s", time.Now().Format("20060102150405"))
	order, err := ordersDomain.NewOrder(
		orderNumber,
		ordersDomain.PlatformAffiliate,
		req.CustomerName,
		req.ProductName,
		req.Quantity,
	)
	if err != nil {
		return nil, err
	}

	order.CustomerEmail = req.CustomerEmail
	order.CustomerPhone = req.CustomerPhone
	order.OrganizationID = organizationID
	order.AffiliateID = affiliate.ID
	order.Priority = ordersDomain.OrderPriority(req.Priority)
	order.Amount = req.FinalPrice
	order.Balance = req.FinalPrice
	order.Notes = fmt.Sprintf("🤝 Pedido registrado por el afiliado %s", affiliate.DisplayName)
	if req.CustomerNotes != "" {
		order.Notes += fmt.Sprintf("\n📝 %s", req.CustomerNotes)
	}
	if len(req.ReferenceImages) > 0 {
		order.ProductImage = req.ReferenceImages[0]
		order.Metadata = map[string]interface{}{
			"affiliate_order_request_id": req.ID,
			"affiliate_reference_images": req.ReferenceImages,
			"affiliate_referral_code":    affiliate.ReferralCode,
		}
	}

	if err := h.orderRepo.Create(order); err != nil {
		return nil, err
	}

	// 2. Calcular y registrar la comisión pendiente (snapshot, no se
	//    recalcula si la comisión del afiliado cambia después).
	commissionAmount := affiliate.CalculateCommission(req.FinalPrice)
	commission := domain.NewAffiliateCommission(affiliate.ID, req.ID, order.ID, commissionAmount)
	commission.OrganizationID = organizationID
	if err := h.repo.CreateCommission(commission); err != nil {
		return nil, err
	}

	// 3. Marcar la solicitud como aprobada, vinculada a la orden creada.
	if err := req.Approve(cmd.ReviewedBy, order.ID); err != nil {
		return nil, err
	}
	if err := h.repo.UpdateOrderRequest(req); err != nil {
		return nil, err
	}

	return &ApproveOrderRequestResult{Order: order, Commission: commission}, nil
}
