package app

import (
	"context"

	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
)

type RejectOrderRequestCommand struct {
	RequestID       string
	ReviewedBy      string
	RejectionReason string
}

type RejectOrderRequestHandler struct {
	repo domain.AffiliateRepository
}

func NewRejectOrderRequestHandler(repo domain.AffiliateRepository) *RejectOrderRequestHandler {
	return &RejectOrderRequestHandler{repo: repo}
}

func (h *RejectOrderRequestHandler) Handle(ctx context.Context, cmd RejectOrderRequestCommand) (*domain.AffiliateOrderRequest, error) {
	req, err := h.repo.FindOrderRequestByID(cmd.RequestID, organizationIDFromContext(ctx))
	if err != nil {
		return nil, err
	}

	if err := req.Reject(cmd.ReviewedBy, cmd.RejectionReason); err != nil {
		return nil, err
	}

	if err := h.repo.UpdateOrderRequest(req); err != nil {
		return nil, err
	}

	return req, nil
}
