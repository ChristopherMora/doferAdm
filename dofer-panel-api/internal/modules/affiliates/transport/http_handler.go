package transport

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/dofer/panel-api/internal/modules/affiliates/app"
	"github.com/dofer/panel-api/internal/modules/affiliates/domain"
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
)

type AffiliateHandler struct {
	createAffiliateHandler      *app.CreateAffiliateHandler
	listAffiliatesHandler       *app.ListAffiliatesHandler
	getAffiliateHandler         *app.GetAffiliateHandler
	getAffiliateByUserIDHandler *app.GetAffiliateByUserIDHandler
	updateAffiliateHandler      *app.UpdateAffiliateHandler
	createOrderRequestHandler   *app.CreateOrderRequestHandler
	listOrderRequestsHandler    *app.ListOrderRequestsHandler
	getOrderRequestHandler      *app.GetOrderRequestHandler
	approveOrderRequestHandler  *app.ApproveOrderRequestHandler
	rejectOrderRequestHandler   *app.RejectOrderRequestHandler
	listCommissionsHandler      *app.ListCommissionsHandler
	markCommissionPaidHandler   *app.MarkCommissionPaidHandler
	getAffiliateStatsHandler    *app.GetAffiliateStatsHandler
	listActiveProductsHandler   *app.ListActiveProductsForAffiliateHandler
}

func NewAffiliateHandler(
	createAffiliateHandler *app.CreateAffiliateHandler,
	listAffiliatesHandler *app.ListAffiliatesHandler,
	getAffiliateHandler *app.GetAffiliateHandler,
	getAffiliateByUserIDHandler *app.GetAffiliateByUserIDHandler,
	updateAffiliateHandler *app.UpdateAffiliateHandler,
	createOrderRequestHandler *app.CreateOrderRequestHandler,
	listOrderRequestsHandler *app.ListOrderRequestsHandler,
	getOrderRequestHandler *app.GetOrderRequestHandler,
	approveOrderRequestHandler *app.ApproveOrderRequestHandler,
	rejectOrderRequestHandler *app.RejectOrderRequestHandler,
	listCommissionsHandler *app.ListCommissionsHandler,
	markCommissionPaidHandler *app.MarkCommissionPaidHandler,
	getAffiliateStatsHandler *app.GetAffiliateStatsHandler,
	listActiveProductsHandler *app.ListActiveProductsForAffiliateHandler,
) *AffiliateHandler {
	return &AffiliateHandler{
		createAffiliateHandler:      createAffiliateHandler,
		listAffiliatesHandler:       listAffiliatesHandler,
		getAffiliateHandler:         getAffiliateHandler,
		getAffiliateByUserIDHandler: getAffiliateByUserIDHandler,
		updateAffiliateHandler:      updateAffiliateHandler,
		createOrderRequestHandler:   createOrderRequestHandler,
		listOrderRequestsHandler:    listOrderRequestsHandler,
		getOrderRequestHandler:      getOrderRequestHandler,
		approveOrderRequestHandler:  approveOrderRequestHandler,
		rejectOrderRequestHandler:   rejectOrderRequestHandler,
		listCommissionsHandler:      listCommissionsHandler,
		markCommissionPaidHandler:   markCommissionPaidHandler,
		getAffiliateStatsHandler:    getAffiliateStatsHandler,
		listActiveProductsHandler:   listActiveProductsHandler,
	}
}

// resolveOwnAffiliate resuelve el afiliado dueño de la sesión actual a partir
// del user_id del JWT. Se usa en TODOS los endpoints /affiliates/me/*, nunca
// se acepta un affiliate_id que venga del body o de query params del cliente.
func (h *AffiliateHandler) resolveOwnAffiliate(r *http.Request) (*domain.Affiliate, error) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || strings.TrimSpace(userID) == "" {
		return nil, errUnauthorized
	}
	return h.getAffiliateByUserIDHandler.Handle(r.Context(), userID)
}

var errUnauthorized = &httpError{status: http.StatusUnauthorized, message: "unauthorized"}

type httpError struct {
	status  int
	message string
}

func (e *httpError) Error() string { return e.message }

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	http.Error(w, message, status)
}

// ---- Admin: gestión de afiliados ----

type CreateAffiliateRequest struct {
	DisplayName     string  `json:"display_name"`
	Email           string  `json:"email"`
	Phone           string  `json:"phone"`
	CommissionType  string  `json:"commission_type"`
	CommissionValue float64 `json:"commission_value"`
	Notes           string  `json:"notes"`
}

func (h *AffiliateHandler) CreateAffiliate(w http.ResponseWriter, r *http.Request) {
	var req CreateAffiliateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	createdBy, _ := middleware.UserIDFromContext(r.Context())

	cmd := app.CreateAffiliateCommand{
		DisplayName:     req.DisplayName,
		Email:           req.Email,
		Phone:           req.Phone,
		CommissionType:  domain.CommissionType(req.CommissionType),
		CommissionValue: req.CommissionValue,
		Notes:           req.Notes,
		CreatedBy:       createdBy,
	}

	result, err := h.createAffiliateHandler.Handle(r.Context(), cmd)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"affiliate":          result.Affiliate,
		"temporary_password": result.TemporaryPassword,
		"message":            "Afiliado creado. Comparte la contraseña temporal de forma segura; no se mostrará de nuevo.",
	})
}

func (h *AffiliateHandler) ListAffiliates(w http.ResponseWriter, r *http.Request) {
	filters := domain.AffiliateFilters{Status: r.URL.Query().Get("status")}

	affiliates, err := h.listAffiliatesHandler.Handle(r.Context(), filters)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"affiliates": affiliates, "total": len(affiliates)})
}

func (h *AffiliateHandler) GetAffiliate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	affiliate, err := h.getAffiliateHandler.Handle(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, affiliate)
}

type UpdateAffiliateRequest struct {
	DisplayName     *string  `json:"display_name,omitempty"`
	Phone           *string  `json:"phone,omitempty"`
	CommissionType  *string  `json:"commission_type,omitempty"`
	CommissionValue *float64 `json:"commission_value,omitempty"`
	Status          *string  `json:"status,omitempty"`
	Notes           *string  `json:"notes,omitempty"`
}

func (h *AffiliateHandler) UpdateAffiliate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req UpdateAffiliateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	cmd := app.UpdateAffiliateCommand{AffiliateID: id, DisplayName: req.DisplayName, Phone: req.Phone, Notes: req.Notes}
	if req.CommissionType != nil {
		ct := domain.CommissionType(*req.CommissionType)
		cmd.CommissionType = &ct
	}
	cmd.CommissionValue = req.CommissionValue
	if req.Status != nil {
		st := domain.AffiliateStatus(*req.Status)
		cmd.Status = &st
	}

	affiliate, err := h.updateAffiliateHandler.Handle(r.Context(), cmd)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, affiliate)
}

func (h *AffiliateHandler) GetAffiliateStats(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	stats, err := h.getAffiliateStatsHandler.Handle(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

func (h *AffiliateHandler) ListAffiliateRequests(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	requests, err := h.listOrderRequestsHandler.Handle(r.Context(), domain.OrderRequestFilters{AffiliateID: id})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"requests": requests, "total": len(requests)})
}

func (h *AffiliateHandler) ListAffiliateCommissions(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	commissions, err := h.listCommissionsHandler.Handle(r.Context(), domain.CommissionFilters{AffiliateID: id})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"commissions": commissions, "total": len(commissions)})
}

// ---- Admin: bandeja global de solicitudes y comisiones ----

func (h *AffiliateHandler) ListAllOrderRequests(w http.ResponseWriter, r *http.Request) {
	filters := domain.OrderRequestFilters{
		AffiliateID: r.URL.Query().Get("affiliate_id"),
		Status:      r.URL.Query().Get("status"),
	}

	requests, err := h.listOrderRequestsHandler.Handle(r.Context(), filters)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"requests": requests, "total": len(requests)})
}

func (h *AffiliateHandler) GetOrderRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	req, err := h.getOrderRequestHandler.Handle(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, req)
}

func (h *AffiliateHandler) ApproveOrderRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	reviewedBy, _ := middleware.UserIDFromContext(r.Context())

	result, err := h.approveOrderRequestHandler.Handle(r.Context(), app.ApproveOrderRequestCommand{
		RequestID:  id,
		ReviewedBy: reviewedBy,
	})
	if err != nil {
		if err == domain.ErrRequestNotPending {
			writeError(w, http.StatusBadRequest, "La solicitud ya fue revisada")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"order":      result.Order,
		"commission": result.Commission,
		"message":    "Solicitud aprobada: se generó el pedido y la comisión pendiente",
	})
}

type RejectOrderRequestRequest struct {
	RejectionReason string `json:"rejection_reason"`
}

func (h *AffiliateHandler) RejectOrderRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req RejectOrderRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	reviewedBy, _ := middleware.UserIDFromContext(r.Context())

	updated, err := h.rejectOrderRequestHandler.Handle(r.Context(), app.RejectOrderRequestCommand{
		RequestID:       id,
		ReviewedBy:      reviewedBy,
		RejectionReason: req.RejectionReason,
	})
	if err != nil {
		if err == domain.ErrRequestNotPending || err == domain.ErrRejectionReasonEmpty {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"request": updated, "message": "Solicitud rechazada"})
}

func (h *AffiliateHandler) ListAllCommissions(w http.ResponseWriter, r *http.Request) {
	filters := domain.CommissionFilters{
		AffiliateID: r.URL.Query().Get("affiliate_id"),
		Status:      r.URL.Query().Get("status"),
	}

	commissions, err := h.listCommissionsHandler.Handle(r.Context(), filters)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"commissions": commissions, "total": len(commissions)})
}

type PayCommissionRequest struct {
	PaymentNotes string `json:"payment_notes"`
}

func (h *AffiliateHandler) PayCommission(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req PayCommissionRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	paidBy, _ := middleware.UserIDFromContext(r.Context())

	commission, err := h.markCommissionPaidHandler.Handle(r.Context(), app.MarkCommissionPaidCommand{
		CommissionID: id,
		PaidBy:       paidBy,
		PaymentNotes: req.PaymentNotes,
	})
	if err != nil {
		if err == app.ErrCommissionAlreadyPaid {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"commission": commission, "message": "Comisión marcada como pagada"})
}

// ---- Auto-servicio del afiliado (/affiliates/me/*) ----

func (h *AffiliateHandler) GetMyProfile(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, affiliate)
}

// ListMyAvailableProducts expone el catálogo activo con precio sugerido
// para que el afiliado elija al armar una solicitud, sin darle acceso al
// módulo /products (reservado a admin/operator/viewer).
func (h *AffiliateHandler) ListMyAvailableProducts(w http.ResponseWriter, r *http.Request) {
	products, err := h.listActiveProductsHandler.Handle(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"products": products})
}

type CreateMyOrderRequestRequest struct {
	ProductID     string  `json:"product_id"`
	ProductName   string  `json:"product_name"`
	Quantity      int     `json:"quantity"`
	FinalPrice    float64 `json:"final_price"`
	CustomerName  string  `json:"customer_name"`
	CustomerEmail string  `json:"customer_email"`
	CustomerPhone string  `json:"customer_phone"`
	CustomerNotes string  `json:"customer_notes"`
}

func (h *AffiliateHandler) CreateMyOrderRequest(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var req CreateMyOrderRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	created, err := h.createOrderRequestHandler.Handle(r.Context(), app.CreateOrderRequestCommand{
		AffiliateID:   affiliate.ID,
		ProductID:     req.ProductID,
		ProductName:   req.ProductName,
		Quantity:      req.Quantity,
		FinalPrice:    req.FinalPrice,
		CustomerName:  req.CustomerName,
		CustomerEmail: req.CustomerEmail,
		CustomerPhone: req.CustomerPhone,
		CustomerNotes: req.CustomerNotes,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

func (h *AffiliateHandler) ListMyOrderRequests(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	// El affiliate_id SIEMPRE se fuerza al propio afiliado resuelto por
	// sesión; cualquier query param de affiliate_id enviado aquí se ignora.
	requests, err := h.listOrderRequestsHandler.Handle(r.Context(), domain.OrderRequestFilters{AffiliateID: affiliate.ID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"requests": requests, "total": len(requests)})
}

func (h *AffiliateHandler) ListMyCommissions(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	commissions, err := h.listCommissionsHandler.Handle(r.Context(), domain.CommissionFilters{AffiliateID: affiliate.ID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var pending, paid float64
	for _, c := range commissions {
		if c.Status == domain.CommissionPaid {
			paid += c.CommissionAmount
		} else {
			pending += c.CommissionAmount
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"commissions":        commissions,
		"total":              len(commissions),
		"total_pending":      pending,
		"total_paid":         paid,
	})
}
