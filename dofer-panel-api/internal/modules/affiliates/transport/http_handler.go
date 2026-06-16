package transport

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

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
	updateAffiliateAccount      *app.UpdateAffiliateAccountHandler
	deleteAffiliateHandler      *app.DeleteAffiliateHandler
	createOrderRequestHandler   *app.CreateOrderRequestHandler
	listOrderRequestsHandler    *app.ListOrderRequestsHandler
	getOrderRequestHandler      *app.GetOrderRequestHandler
	approveOrderRequestHandler  *app.ApproveOrderRequestHandler
	rejectOrderRequestHandler   *app.RejectOrderRequestHandler
	listCommissionsHandler      *app.ListCommissionsHandler
	markCommissionPaidHandler   *app.MarkCommissionPaidHandler
	getAffiliateStatsHandler    *app.GetAffiliateStatsHandler
	listActiveProductsHandler   *app.ListActiveProductsForAffiliateHandler
	orderRequestControlHandler  *app.OrderRequestControlHandler
}

func NewAffiliateHandler(
	createAffiliateHandler *app.CreateAffiliateHandler,
	listAffiliatesHandler *app.ListAffiliatesHandler,
	getAffiliateHandler *app.GetAffiliateHandler,
	getAffiliateByUserIDHandler *app.GetAffiliateByUserIDHandler,
	updateAffiliateHandler *app.UpdateAffiliateHandler,
	updateAffiliateAccount *app.UpdateAffiliateAccountHandler,
	deleteAffiliateHandler *app.DeleteAffiliateHandler,
	createOrderRequestHandler *app.CreateOrderRequestHandler,
	listOrderRequestsHandler *app.ListOrderRequestsHandler,
	getOrderRequestHandler *app.GetOrderRequestHandler,
	approveOrderRequestHandler *app.ApproveOrderRequestHandler,
	rejectOrderRequestHandler *app.RejectOrderRequestHandler,
	listCommissionsHandler *app.ListCommissionsHandler,
	markCommissionPaidHandler *app.MarkCommissionPaidHandler,
	getAffiliateStatsHandler *app.GetAffiliateStatsHandler,
	listActiveProductsHandler *app.ListActiveProductsForAffiliateHandler,
	orderRequestControlHandler *app.OrderRequestControlHandler,
) *AffiliateHandler {
	return &AffiliateHandler{
		createAffiliateHandler:      createAffiliateHandler,
		listAffiliatesHandler:       listAffiliatesHandler,
		getAffiliateHandler:         getAffiliateHandler,
		getAffiliateByUserIDHandler: getAffiliateByUserIDHandler,
		updateAffiliateHandler:      updateAffiliateHandler,
		updateAffiliateAccount:      updateAffiliateAccount,
		deleteAffiliateHandler:      deleteAffiliateHandler,
		createOrderRequestHandler:   createOrderRequestHandler,
		listOrderRequestsHandler:    listOrderRequestsHandler,
		getOrderRequestHandler:      getOrderRequestHandler,
		approveOrderRequestHandler:  approveOrderRequestHandler,
		rejectOrderRequestHandler:   rejectOrderRequestHandler,
		listCommissionsHandler:      listCommissionsHandler,
		markCommissionPaidHandler:   markCommissionPaidHandler,
		getAffiliateStatsHandler:    getAffiliateStatsHandler,
		listActiveProductsHandler:   listActiveProductsHandler,
		orderRequestControlHandler:  orderRequestControlHandler,
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
	affiliate, err := h.getAffiliateByUserIDHandler.Handle(r.Context(), userID)
	if err != nil {
		return nil, err
	}
	if affiliate.Status == domain.AffiliateSuspended {
		return nil, errAffiliateSuspended
	}
	return affiliate, nil
}

var errUnauthorized = &httpError{status: http.StatusUnauthorized, message: "unauthorized"}
var errAffiliateSuspended = &httpError{status: http.StatusForbidden, message: "cuenta de afiliado suspendida"}

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

func writeAffiliateAccessError(w http.ResponseWriter, err error) {
	var httpErr *httpError
	if errors.As(err, &httpErr) {
		writeError(w, httpErr.status, httpErr.message)
		return
	}
	writeError(w, http.StatusUnauthorized, err.Error())
}

func parseDateInput(value string) (*time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

// ---- Admin: gestión de afiliados ----

type CreateAffiliateRequest struct {
	DisplayName        string  `json:"display_name"`
	Email              string  `json:"email"`
	Phone              string  `json:"phone"`
	ReferralCode       string  `json:"referral_code"`
	CommissionType     string  `json:"commission_type"`
	CommissionValue    float64 `json:"commission_value"`
	MaxPendingRequests int     `json:"max_pending_requests"`
	AllowUrgentOrders  *bool   `json:"allow_urgent_orders"`
	Notes              string  `json:"notes"`
}

func (h *AffiliateHandler) CreateAffiliate(w http.ResponseWriter, r *http.Request) {
	var req CreateAffiliateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	createdBy, _ := middleware.UserIDFromContext(r.Context())
	organizationID, _ := middleware.OrganizationIDFromContext(r.Context())

	cmd := app.CreateAffiliateCommand{
		OrganizationID:     organizationID,
		DisplayName:        req.DisplayName,
		Email:              req.Email,
		Phone:              req.Phone,
		ReferralCode:       req.ReferralCode,
		CommissionType:     domain.CommissionType(req.CommissionType),
		CommissionValue:    req.CommissionValue,
		MaxPendingRequests: req.MaxPendingRequests,
		AllowUrgentOrders:  req.AllowUrgentOrders,
		Notes:              req.Notes,
		CreatedBy:          createdBy,
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
	DisplayName        *string  `json:"display_name,omitempty"`
	Phone              *string  `json:"phone,omitempty"`
	CommissionType     *string  `json:"commission_type,omitempty"`
	CommissionValue    *float64 `json:"commission_value,omitempty"`
	MaxPendingRequests *int     `json:"max_pending_requests,omitempty"`
	AllowUrgentOrders  *bool    `json:"allow_urgent_orders,omitempty"`
	Status             *string  `json:"status,omitempty"`
	Notes              *string  `json:"notes,omitempty"`
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
	cmd.MaxPendingRequests = req.MaxPendingRequests
	cmd.AllowUrgentOrders = req.AllowUrgentOrders
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

type UpdateAffiliateEmailRequest struct {
	Email string `json:"email"`
}

func (h *AffiliateHandler) UpdateAffiliateEmail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateAffiliateEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	organizationID, _ := middleware.OrganizationIDFromContext(r.Context())

	affiliate, err := h.updateAffiliateAccount.UpdateEmail(r.Context(), app.UpdateAffiliateEmailCommand{
		AffiliateID:    id,
		OrganizationID: organizationID,
		Email:          req.Email,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"affiliate": affiliate, "message": "Correo de acceso actualizado"})
}

func (h *AffiliateHandler) ResetAffiliatePassword(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	organizationID, _ := middleware.OrganizationIDFromContext(r.Context())

	result, err := h.updateAffiliateAccount.ResetPassword(r.Context(), app.ResetAffiliatePasswordCommand{
		AffiliateID:    id,
		OrganizationID: organizationID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"affiliate":          result.Affiliate,
		"temporary_password": result.TemporaryPassword,
		"message":            "Contraseña temporal generada. Compártela de forma segura; no se mostrará de nuevo.",
	})
}

func (h *AffiliateHandler) DeleteAffiliate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	organizationID, _ := middleware.OrganizationIDFromContext(r.Context())

	result, err := h.deleteAffiliateHandler.Handle(r.Context(), app.DeleteAffiliateCommand{
		AffiliateID:    id,
		OrganizationID: organizationID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	response := map[string]interface{}{
		"affiliate":    result.Affiliate,
		"auth_deleted": result.AuthDeleted,
		"message":      "Afiliado eliminado",
	}
	if result.AuthDeleteError != "" {
		response["auth_delete_error"] = result.AuthDeleteError
		response["message"] = "Afiliado eliminado del panel; revisa la cuenta de Supabase Auth"
	}
	writeJSON(w, http.StatusOK, response)
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
		Priority:    r.URL.Query().Get("priority"),
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

func (h *AffiliateHandler) GetOrderRequestDetail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	detail, err := h.orderRequestControlHandler.Detail(r.Context(), id, true)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, detail)
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

type RequestChangesRequest struct {
	Reason string `json:"reason"`
}

func (h *AffiliateHandler) RequestOrderRequestChanges(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req RequestChangesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	reviewedBy, _ := middleware.UserIDFromContext(r.Context())
	updated, err := h.orderRequestControlHandler.RequestChanges(r.Context(), id, reviewedBy, req.Reason)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"request": updated, "message": "Cambios solicitados"})
}

type CreateOrderRequestCommentRequest struct {
	Message      string `json:"message"`
	InternalOnly bool   `json:"internal_only"`
}

func (h *AffiliateHandler) CreateOrderRequestComment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req CreateOrderRequestCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	role, _ := middleware.UserRoleFromContext(r.Context())
	if role == "" {
		role = "operator"
	}
	comment, err := h.orderRequestControlHandler.AddComment(r.Context(), id, userID, role, req.Message, req.InternalOnly)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, comment)
}

type UpdateOrderRequestOperationsRequest struct {
	CustomerAmountPaid       float64         `json:"customer_amount_paid"`
	CustomerPaymentMethod    string          `json:"customer_payment_method"`
	CustomerPaymentReference string          `json:"customer_payment_reference"`
	CustomerPaymentNotes     string          `json:"customer_payment_notes"`
	PromisedDeliveryDate     string          `json:"promised_delivery_date"`
	DeliveryMethod           string          `json:"delivery_method"`
	DeliveryStatus           string          `json:"delivery_status"`
	DeliveryAddress          string          `json:"delivery_address"`
	DeliveryTrackingNumber   string          `json:"delivery_tracking_number"`
	DeliveryNotes            string          `json:"delivery_notes"`
	ProductionChecklist      map[string]bool `json:"production_checklist"`
	InternalOwnerID          string          `json:"internal_owner_id"`
}

func (h *AffiliateHandler) UpdateOrderRequestOperations(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateOrderRequestOperationsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	promisedDate, err := parseDateInput(req.PromisedDeliveryDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid promised_delivery_date")
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	updated, err := h.orderRequestControlHandler.UpdateOperations(r.Context(), app.UpdateOrderRequestOperationsCommand{
		RequestID:                id,
		ActorUserID:              userID,
		CustomerAmountPaid:       req.CustomerAmountPaid,
		CustomerPaymentMethod:    req.CustomerPaymentMethod,
		CustomerPaymentReference: req.CustomerPaymentReference,
		CustomerPaymentNotes:     req.CustomerPaymentNotes,
		PromisedDeliveryDate:     promisedDate,
		DeliveryMethod:           req.DeliveryMethod,
		DeliveryStatus:           req.DeliveryStatus,
		DeliveryAddress:          req.DeliveryAddress,
		DeliveryTrackingNumber:   req.DeliveryTrackingNumber,
		DeliveryNotes:            req.DeliveryNotes,
		ProductionChecklist:      req.ProductionChecklist,
		InternalOwnerID:          req.InternalOwnerID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"request": updated, "message": "Control operativo actualizado"})
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
	PaymentMethod    string `json:"payment_method"`
	PaymentReference string `json:"payment_reference"`
	PaymentNotes     string `json:"payment_notes"`
}

func (h *AffiliateHandler) PayCommission(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req PayCommissionRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	paidBy, _ := middleware.UserIDFromContext(r.Context())

	commission, err := h.markCommissionPaidHandler.Handle(r.Context(), app.MarkCommissionPaidCommand{
		CommissionID:     id,
		PaidBy:           paidBy,
		PaymentMethod:    req.PaymentMethod,
		PaymentReference: req.PaymentReference,
		PaymentNotes:     req.PaymentNotes,
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

type PayCommissionsBatchRequest struct {
	CommissionIDs    []string `json:"commission_ids"`
	PaymentMethod    string   `json:"payment_method"`
	PaymentReference string   `json:"payment_reference"`
	PaymentNotes     string   `json:"payment_notes"`
}

func (h *AffiliateHandler) PayCommissionsBatch(w http.ResponseWriter, r *http.Request) {
	var req PayCommissionsBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	paidBy, _ := middleware.UserIDFromContext(r.Context())
	commissions, err := h.markCommissionPaidHandler.HandleBatch(r.Context(), app.MarkCommissionsPaidBatchCommand{
		CommissionIDs:    req.CommissionIDs,
		PaidBy:           paidBy,
		PaymentMethod:    req.PaymentMethod,
		PaymentReference: req.PaymentReference,
		PaymentNotes:     req.PaymentNotes,
	})
	if err != nil {
		if err == app.ErrCommissionAlreadyPaid {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"commissions": commissions,
		"total":       len(commissions),
		"message":     "Comisiones marcadas como pagadas",
	})
}

// ---- Auto-servicio del afiliado (/affiliates/me/*) ----

func (h *AffiliateHandler) GetMyProfile(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeAffiliateAccessError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, affiliate)
}

// ListMyAvailableProducts expone el catálogo activo con precio sugerido
// para que el afiliado elija al armar una solicitud, sin darle acceso al
// módulo /products (reservado a admin/operator/viewer).
func (h *AffiliateHandler) ListMyAvailableProducts(w http.ResponseWriter, r *http.Request) {
	if _, err := h.resolveOwnAffiliate(r); err != nil {
		writeAffiliateAccessError(w, err)
		return
	}

	products, err := h.listActiveProductsHandler.Handle(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"products": products})
}

type CreateMyOrderRequestRequest struct {
	ProductID                string   `json:"product_id"`
	ProductName              string   `json:"product_name"`
	Quantity                 int      `json:"quantity"`
	FinalPrice               float64  `json:"final_price"`
	CustomerAmountPaid       float64  `json:"customer_amount_paid"`
	CustomerPaymentMethod    string   `json:"customer_payment_method"`
	CustomerPaymentReference string   `json:"customer_payment_reference"`
	CustomerPaymentNotes     string   `json:"customer_payment_notes"`
	Priority                 string   `json:"priority"`
	ReferenceImages          []string `json:"reference_images"`
	CustomerName             string   `json:"customer_name"`
	CustomerEmail            string   `json:"customer_email"`
	CustomerPhone            string   `json:"customer_phone"`
	CustomerNotes            string   `json:"customer_notes"`
	PromisedDeliveryDate     string   `json:"promised_delivery_date"`
	DeliveryMethod           string   `json:"delivery_method"`
	DeliveryAddress          string   `json:"delivery_address"`
	DeliveryNotes            string   `json:"delivery_notes"`
	DuplicatedFromRequestID  string   `json:"duplicated_from_request_id"`
}

func (h *AffiliateHandler) CreateMyOrderRequest(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeAffiliateAccessError(w, err)
		return
	}

	var req CreateMyOrderRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	promisedDate, err := parseDateInput(req.PromisedDeliveryDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid promised_delivery_date")
		return
	}

	created, err := h.createOrderRequestHandler.Handle(r.Context(), app.CreateOrderRequestCommand{
		OrganizationID:           affiliate.OrganizationID,
		AffiliateID:              affiliate.ID,
		ProductID:                req.ProductID,
		ProductName:              req.ProductName,
		Quantity:                 req.Quantity,
		FinalPrice:               req.FinalPrice,
		CustomerAmountPaid:       req.CustomerAmountPaid,
		CustomerPaymentMethod:    req.CustomerPaymentMethod,
		CustomerPaymentReference: req.CustomerPaymentReference,
		CustomerPaymentNotes:     req.CustomerPaymentNotes,
		Priority:                 req.Priority,
		ReferenceImages:          req.ReferenceImages,
		CustomerName:             req.CustomerName,
		CustomerEmail:            req.CustomerEmail,
		CustomerPhone:            req.CustomerPhone,
		CustomerNotes:            req.CustomerNotes,
		PromisedDeliveryDate:     promisedDate,
		DeliveryMethod:           req.DeliveryMethod,
		DeliveryAddress:          req.DeliveryAddress,
		DeliveryNotes:            req.DeliveryNotes,
		DuplicatedFromRequestID:  req.DuplicatedFromRequestID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

func (h *AffiliateHandler) GetMyOrderRequestDetail(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeAffiliateAccessError(w, err)
		return
	}
	id := chi.URLParam(r, "id")
	detail, err := h.orderRequestControlHandler.Detail(r.Context(), id, false)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	if detail.Request.AffiliateID != affiliate.ID {
		writeError(w, http.StatusNotFound, "affiliate order request not found")
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (h *AffiliateHandler) UpdateMyOrderRequest(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeAffiliateAccessError(w, err)
		return
	}
	id := chi.URLParam(r, "id")
	var req CreateMyOrderRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	promisedDate, err := parseDateInput(req.PromisedDeliveryDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid promised_delivery_date")
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	updated, err := h.orderRequestControlHandler.UpdateOwn(r.Context(), app.UpdateOwnOrderRequestCommand{
		RequestID:                id,
		AffiliateID:              affiliate.ID,
		ProductID:                req.ProductID,
		ProductName:              req.ProductName,
		Quantity:                 req.Quantity,
		FinalPrice:               req.FinalPrice,
		CustomerAmountPaid:       req.CustomerAmountPaid,
		CustomerPaymentMethod:    req.CustomerPaymentMethod,
		CustomerPaymentReference: req.CustomerPaymentReference,
		CustomerPaymentNotes:     req.CustomerPaymentNotes,
		Priority:                 req.Priority,
		ReferenceImages:          req.ReferenceImages,
		CustomerName:             req.CustomerName,
		CustomerEmail:            req.CustomerEmail,
		CustomerPhone:            req.CustomerPhone,
		CustomerNotes:            req.CustomerNotes,
		PromisedDeliveryDate:     promisedDate,
		DeliveryMethod:           req.DeliveryMethod,
		DeliveryAddress:          req.DeliveryAddress,
		DeliveryNotes:            req.DeliveryNotes,
		ActorUserID:              userID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

type CancelMyOrderRequestRequest struct {
	Reason string `json:"reason"`
}

func (h *AffiliateHandler) CancelMyOrderRequest(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeAffiliateAccessError(w, err)
		return
	}
	id := chi.URLParam(r, "id")
	var req CancelMyOrderRequestRequest
	_ = json.NewDecoder(r.Body).Decode(&req)
	userID, _ := middleware.UserIDFromContext(r.Context())
	updated, err := h.orderRequestControlHandler.CancelOwn(r.Context(), id, affiliate.ID, userID, req.Reason)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"request": updated, "message": "Solicitud cancelada"})
}

func (h *AffiliateHandler) CreateMyOrderRequestComment(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeAffiliateAccessError(w, err)
		return
	}
	id := chi.URLParam(r, "id")
	detail, err := h.orderRequestControlHandler.Detail(r.Context(), id, false)
	if err != nil || detail.Request.AffiliateID != affiliate.ID {
		writeError(w, http.StatusNotFound, "affiliate order request not found")
		return
	}
	var req CreateOrderRequestCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	comment, err := h.orderRequestControlHandler.AddComment(r.Context(), id, userID, "affiliate", req.Message, false)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, comment)
}

func (h *AffiliateHandler) ListMyOrderRequests(w http.ResponseWriter, r *http.Request) {
	affiliate, err := h.resolveOwnAffiliate(r)
	if err != nil {
		writeAffiliateAccessError(w, err)
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
		writeAffiliateAccessError(w, err)
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
		"commissions":   commissions,
		"total":         len(commissions),
		"total_pending": pending,
		"total_paid":    paid,
	})
}
