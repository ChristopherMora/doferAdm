package app

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
	"github.com/dofer/panel-api/internal/modules/products"
	"github.com/google/uuid"
)

type OrderRequestDetail struct {
	Request  *domain.AffiliateOrderRequest          `json:"request"`
	Events   []*domain.AffiliateOrderRequestEvent   `json:"events"`
	Comments []*domain.AffiliateOrderRequestComment `json:"comments"`
}

type OrderRequestControlHandler struct {
	repo        domain.AffiliateRepository
	productRepo *products.Repository
}

func NewOrderRequestControlHandler(repo domain.AffiliateRepository, productRepo *products.Repository) *OrderRequestControlHandler {
	return &OrderRequestControlHandler{repo: repo, productRepo: productRepo}
}

func (h *OrderRequestControlHandler) Detail(ctx context.Context, requestID string, includeInternal bool) (*OrderRequestDetail, error) {
	organizationID := organizationIDFromContext(ctx)
	req, err := h.repo.FindOrderRequestByID(requestID, organizationID)
	if err != nil {
		return nil, err
	}
	events, err := h.repo.ListOrderRequestEvents(organizationID, req.ID)
	if err != nil {
		return nil, err
	}
	comments, err := h.repo.ListOrderRequestComments(organizationID, req.ID, includeInternal)
	if err != nil {
		return nil, err
	}
	return &OrderRequestDetail{Request: req, Events: events, Comments: comments}, nil
}

type UpdateOwnOrderRequestCommand struct {
	RequestID                string
	AffiliateID              string
	ProductID                string
	ProductName              string
	Quantity                 int
	FinalPrice               float64
	CustomerAmountPaid       float64
	CustomerPaymentMethod    string
	CustomerPaymentReference string
	CustomerPaymentNotes     string
	Priority                 string
	ReferenceImages          []string
	CustomerName             string
	CustomerEmail            string
	CustomerPhone            string
	CustomerNotes            string
	PromisedDeliveryDate     *time.Time
	DeliveryMethod           string
	DeliveryAddress          string
	DeliveryNotes            string
	ActorUserID              string
}

func (h *OrderRequestControlHandler) UpdateOwn(ctx context.Context, cmd UpdateOwnOrderRequestCommand) (*domain.AffiliateOrderRequest, error) {
	organizationID := organizationIDFromContext(ctx)
	req, err := h.repo.FindOrderRequestByID(cmd.RequestID, organizationID)
	if err != nil {
		return nil, err
	}
	if req.AffiliateID != cmd.AffiliateID {
		return nil, errors.New("affiliate order request not found")
	}
	if req.Status != domain.RequestPending && req.Status != domain.RequestNeedsChanges {
		return nil, domain.ErrRequestFinalized
	}

	affiliate, err := h.repo.FindAffiliateByID(cmd.AffiliateID, organizationID)
	if err != nil {
		return nil, err
	}
	priority := normalizePriority(cmd.Priority)
	if priority == "urgent" && !affiliate.AllowUrgentOrders {
		return nil, errors.New("urgent orders are disabled for this affiliate")
	}

	productName := cmd.ProductName
	var suggestedPriceSnapshot, minPriceSnapshot float64
	commissionTypeSnapshot := string(affiliate.CommissionType)
	commissionValueSnapshot := affiliate.CommissionValue

	if cmd.ProductID != "" {
		productUUID, parseErr := uuid.Parse(cmd.ProductID)
		if parseErr != nil {
			return nil, errors.New("invalid product id")
		}
		product, err := h.productRepo.GetByID(ctx, organizationID, productUUID)
		if err != nil {
			return nil, err
		}
		if product == nil || !product.AffiliateVisible || !product.IsActive {
			return nil, errors.New("product is not available for affiliates")
		}
		productName = product.Name
		if product.SuggestedPrice != nil {
			suggestedPriceSnapshot = *product.SuggestedPrice
		}
		if product.AffiliateMinPrice != nil {
			minPriceSnapshot = *product.AffiliateMinPrice
		}
		if product.AffiliateCommissionType != nil && product.AffiliateCommissionValue != nil {
			commissionTypeSnapshot = *product.AffiliateCommissionType
			commissionValueSnapshot = *product.AffiliateCommissionValue
		}
	}
	if minPriceSnapshot > 0 && cmd.FinalPrice < minPriceSnapshot {
		return nil, errors.New("final price is below the affiliate minimum price")
	}
	if cmd.CustomerAmountPaid < 0 {
		return nil, errors.New("customer amount paid cannot be negative")
	}
	if cmd.CustomerAmountPaid > cmd.FinalPrice {
		return nil, errors.New("customer amount paid cannot exceed final price")
	}

	req.ProductID = cmd.ProductID
	req.ProductName = productName
	req.Quantity = cmd.Quantity
	req.SuggestedPriceSnapshot = suggestedPriceSnapshot
	req.MinPriceSnapshot = minPriceSnapshot
	req.FinalPrice = cmd.FinalPrice
	req.CustomerAmountPaid = cmd.CustomerAmountPaid
	req.CustomerPaymentStatus = calculateCustomerPaymentStatus(cmd.CustomerAmountPaid, cmd.FinalPrice)
	req.CustomerPaymentMethod = strings.TrimSpace(cmd.CustomerPaymentMethod)
	req.CustomerPaymentReference = strings.TrimSpace(cmd.CustomerPaymentReference)
	req.CustomerPaymentNotes = strings.TrimSpace(cmd.CustomerPaymentNotes)
	req.Priority = priority
	req.ReferenceImages = sanitizeReferenceImages(cmd.ReferenceImages)
	req.CustomerName = strings.TrimSpace(cmd.CustomerName)
	req.CustomerEmail = strings.TrimSpace(cmd.CustomerEmail)
	req.CustomerPhone = strings.TrimSpace(cmd.CustomerPhone)
	req.CustomerNotes = strings.TrimSpace(cmd.CustomerNotes)
	req.Status = domain.RequestPending
	req.RequestedChanges = ""
	req.PromisedDeliveryDate = cmd.PromisedDeliveryDate
	req.DeliveryMethod = normalizeDeliveryMethod(cmd.DeliveryMethod)
	req.DeliveryAddress = strings.TrimSpace(cmd.DeliveryAddress)
	req.DeliveryNotes = strings.TrimSpace(cmd.DeliveryNotes)
	req.ProductionChecklist = normalizeProductionChecklist(req.ProductionChecklist)
	req.CommissionTypeSnapshot = commissionTypeSnapshot
	req.CommissionValueSnapshot = commissionValueSnapshot

	if _, err := domain.NewAffiliateOrderRequest(req.AffiliateID, req.ProductName, req.CustomerName, req.Quantity, req.FinalPrice); err != nil {
		return nil, err
	}
	if err := h.repo.UpdateOrderRequestDetails(req); err != nil {
		return nil, err
	}
	_ = h.repo.CreateOrderRequestEvent(&domain.AffiliateOrderRequestEvent{
		OrganizationID:          organizationID,
		AffiliateOrderRequestID: req.ID,
		ActorUserID:             cmd.ActorUserID,
		ActorRole:               "affiliate",
		EventType:               "request.updated",
		Message:                 "Solicitud actualizada por el afiliado",
	})
	return req, nil
}

type UpdateOrderRequestOperationsCommand struct {
	RequestID                string
	ActorUserID              string
	CustomerAmountPaid       float64
	CustomerPaymentMethod    string
	CustomerPaymentReference string
	CustomerPaymentNotes     string
	PromisedDeliveryDate     *time.Time
	DeliveryMethod           string
	DeliveryStatus           string
	DeliveryAddress          string
	DeliveryTrackingNumber   string
	DeliveryNotes            string
	ProductionChecklist      map[string]bool
	InternalOwnerID          string
}

func (h *OrderRequestControlHandler) UpdateOperations(ctx context.Context, cmd UpdateOrderRequestOperationsCommand) (*domain.AffiliateOrderRequest, error) {
	organizationID := organizationIDFromContext(ctx)
	req, err := h.repo.FindOrderRequestByID(cmd.RequestID, organizationID)
	if err != nil {
		return nil, err
	}
	if cmd.CustomerAmountPaid < 0 {
		return nil, errors.New("customer amount paid cannot be negative")
	}
	if cmd.CustomerAmountPaid > req.FinalPrice {
		return nil, errors.New("customer amount paid cannot exceed final price")
	}

	req.CustomerAmountPaid = cmd.CustomerAmountPaid
	req.CustomerPaymentStatus = calculateCustomerPaymentStatus(cmd.CustomerAmountPaid, req.FinalPrice)
	req.CustomerPaymentMethod = strings.TrimSpace(cmd.CustomerPaymentMethod)
	req.CustomerPaymentReference = strings.TrimSpace(cmd.CustomerPaymentReference)
	req.CustomerPaymentNotes = strings.TrimSpace(cmd.CustomerPaymentNotes)
	req.PromisedDeliveryDate = cmd.PromisedDeliveryDate
	req.DeliveryMethod = normalizeDeliveryMethod(cmd.DeliveryMethod)
	req.DeliveryStatus = normalizeDeliveryStatus(cmd.DeliveryStatus)
	req.DeliveryAddress = strings.TrimSpace(cmd.DeliveryAddress)
	req.DeliveryTrackingNumber = strings.TrimSpace(cmd.DeliveryTrackingNumber)
	req.DeliveryNotes = strings.TrimSpace(cmd.DeliveryNotes)
	req.ProductionChecklist = normalizeProductionChecklist(cmd.ProductionChecklist)
	req.InternalOwnerID = strings.TrimSpace(cmd.InternalOwnerID)

	if err := h.repo.UpdateOrderRequestDetails(req); err != nil {
		return nil, err
	}
	_ = h.repo.CreateOrderRequestEvent(&domain.AffiliateOrderRequestEvent{
		OrganizationID:          organizationID,
		AffiliateOrderRequestID: req.ID,
		ActorUserID:             cmd.ActorUserID,
		ActorRole:               "operator",
		EventType:               "request.operations_updated",
		Message:                 "Control operativo actualizado",
		Metadata: map[string]interface{}{
			"payment_status":  req.CustomerPaymentStatus,
			"delivery_status": req.DeliveryStatus,
		},
	})
	return req, nil
}

func (h *OrderRequestControlHandler) RequestChanges(ctx context.Context, requestID, actorUserID, reason string) (*domain.AffiliateOrderRequest, error) {
	organizationID := organizationIDFromContext(ctx)
	req, err := h.repo.FindOrderRequestByID(requestID, organizationID)
	if err != nil {
		return nil, err
	}
	if err := req.RequestChanges(actorUserID, strings.TrimSpace(reason)); err != nil {
		return nil, err
	}
	if err := h.repo.UpdateOrderRequest(req); err != nil {
		return nil, err
	}
	_ = h.repo.CreateOrderRequestEvent(&domain.AffiliateOrderRequestEvent{
		OrganizationID:          organizationID,
		AffiliateOrderRequestID: req.ID,
		ActorUserID:             actorUserID,
		ActorRole:               "operator",
		EventType:               "request.changes_requested",
		Message:                 reason,
	})
	return req, nil
}

func (h *OrderRequestControlHandler) CancelOwn(ctx context.Context, requestID, affiliateID, actorUserID, reason string) (*domain.AffiliateOrderRequest, error) {
	organizationID := organizationIDFromContext(ctx)
	req, err := h.repo.FindOrderRequestByID(requestID, organizationID)
	if err != nil {
		return nil, err
	}
	if req.AffiliateID != affiliateID {
		return nil, errors.New("affiliate order request not found")
	}
	if err := req.Cancel(actorUserID, strings.TrimSpace(reason)); err != nil {
		return nil, err
	}
	if err := h.repo.UpdateOrderRequest(req); err != nil {
		return nil, err
	}
	_ = h.repo.CreateOrderRequestEvent(&domain.AffiliateOrderRequestEvent{
		OrganizationID:          organizationID,
		AffiliateOrderRequestID: req.ID,
		ActorUserID:             actorUserID,
		ActorRole:               "affiliate",
		EventType:               "request.cancelled",
		Message:                 reason,
	})
	return req, nil
}

func (h *OrderRequestControlHandler) AddComment(ctx context.Context, requestID, actorUserID, actorRole, message string, internalOnly bool) (*domain.AffiliateOrderRequestComment, error) {
	organizationID := organizationIDFromContext(ctx)
	message = strings.TrimSpace(message)
	if message == "" {
		return nil, errors.New("comment message is required")
	}
	if _, err := h.repo.FindOrderRequestByID(requestID, organizationID); err != nil {
		return nil, err
	}
	comment := &domain.AffiliateOrderRequestComment{
		OrganizationID:          organizationID,
		AffiliateOrderRequestID: requestID,
		AuthorUserID:            actorUserID,
		AuthorRole:              actorRole,
		Message:                 message,
		InternalOnly:            internalOnly,
	}
	if err := h.repo.CreateOrderRequestComment(comment); err != nil {
		return nil, err
	}
	_ = h.repo.CreateOrderRequestEvent(&domain.AffiliateOrderRequestEvent{
		OrganizationID:          organizationID,
		AffiliateOrderRequestID: requestID,
		ActorUserID:             actorUserID,
		ActorRole:               actorRole,
		EventType:               "comment.created",
		Message:                 message,
		Metadata: map[string]interface{}{
			"internal_only": internalOnly,
		},
	})
	return comment, nil
}
