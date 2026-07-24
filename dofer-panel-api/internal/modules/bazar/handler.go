package bazar

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct {
	repo    *Repository
	service *Service
	sheets  SheetsGateway
}

func NewHandler(repo *Repository, service *Service, sheets SheetsGateway) *Handler {
	return &Handler{repo: repo, service: service, sheets: sheets}
}

func RegisterRoutes(r chi.Router, handler *Handler) {
	r.Route("/bazar", func(r chi.Router) {
		r.Use(middleware.RequireRole("admin", "operator", "viewer"))

		r.Get("/bazaars", handler.ListBazaars)
		r.Get("/bazaars/{id}/report", handler.GetBazarReport)
		r.Get("/bazaars/{id}/daily-cuts", handler.ListDailyCuts)
		r.Get("/products", handler.ListProducts)
		r.Get("/products/{id}", handler.GetProduct)
		r.Get("/sales", handler.ListSales)
		r.Get("/stats", handler.GetStats)
		r.Get("/reports/daily", handler.GetDailyReport)
		r.Get("/inventory-movements", handler.ListInventoryMovements)
		r.Get("/audit", handler.ListAudit)
		r.Get("/sync/status", handler.GetSyncStatus)
		r.Get("/sync/conflicts", handler.GetSyncConflicts)

		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireRole("admin", "operator"))
			r.Post("/bazaars", handler.CreateBazar)
			r.Post("/bazaars/{id}/daily-cuts", handler.CloseDailyCut)
			r.Post("/bazaars/{id}/close", handler.CloseBazar)
			r.Post("/products", handler.CreateProduct)
			r.Put("/products/{id}", handler.UpdateProduct)
			r.Post("/products/{id}/adjust-stock", handler.AdjustStock)
			r.Post("/sales", handler.CreateSale)
			r.Post("/sales/{id}/cancel", handler.CancelSale)
			r.Post("/sales/{id}/undo", handler.CancelSale)
			r.Post("/sync", handler.Sync)
		})
	})
}

func (h *Handler) ListDailyCuts(w http.ResponseWriter, r *http.Request) {
	bazarID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, &serviceError{Status: http.StatusBadRequest, Message: "ID de bazar inválido."})
		return
	}
	cuts, err := h.service.ListDailyCuts(r.Context(), organizationID(r), bazarID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"cuts": cuts})
}

func (h *Handler) CloseDailyCut(w http.ResponseWriter, r *http.Request) {
	bazarID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, &serviceError{Status: http.StatusBadRequest, Message: "ID de bazar inválido."})
		return
	}
	userID, err := requestUserID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var req CreateDailyCutRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}
	cut, err := h.service.CloseDailyCut(
		r.Context(),
		organizationID(r),
		bazarID,
		userID,
		requestActorName(r),
		req,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	report, err := h.service.Report(r.Context(), organizationID(r), &bazarID, cut.BusinessDate)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"cut": cut, "report": report})
}

func (h *Handler) ListBazaars(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.ListBazaars(r.Context(), organizationID(r))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"bazaars": items})
}

func (h *Handler) CreateBazar(w http.ResponseWriter, r *http.Request) {
	userID, err := requestUserID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var req CreateBazarRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}

	item, err := h.repo.CreateBazar(r.Context(), organizationID(r), userID, req)
	if err != nil {
		writeError(w, err)
		return
	}
	actorName := requestActorName(r)
	_ = h.repo.RecordAudit(
		r.Context(),
		organizationID(r),
		&item.ID,
		userID,
		actorName,
		"bazar.created",
		"bazar",
		&item.ID,
		map[string]any{"name": item.Name, "opening_cash": item.OpeningCash},
	)
	writeJSON(w, http.StatusCreated, item)
}

func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	products, err := h.repo.ListProducts(
		r.Context(),
		organizationID(r),
		r.URL.Query().Get("q"),
		r.URL.Query().Get("category"),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"products": products})
}

func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, &serviceError{Status: http.StatusBadRequest, Message: "ID de producto inválido."})
		return
	}
	product, err := h.repo.GetProduct(r.Context(), organizationID(r), productID)
	if err != nil {
		writeError(w, err)
		return
	}
	if product == nil {
		writeError(w, &serviceError{Status: http.StatusNotFound, Message: "Producto no encontrado."})
		return
	}
	writeJSON(w, http.StatusOK, product)
}

func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	userID, err := requestUserID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var req CreateProductRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}

	product, err := h.service.CreateProduct(
		r.Context(),
		organizationID(r),
		userID,
		requestActorName(r),
		req,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, product)
}

func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, &serviceError{Status: http.StatusBadRequest, Message: "ID de producto inválido."})
		return
	}
	userID, err := requestUserID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var req UpdateProductRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}
	product, err := h.service.UpdateProduct(
		r.Context(),
		organizationID(r),
		userID,
		requestActorName(r),
		productID,
		req,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, product)
}

func (h *Handler) AdjustStock(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, &serviceError{Status: http.StatusBadRequest, Message: "ID de producto inválido."})
		return
	}
	userID, err := requestUserID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var req AdjustStockRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}
	product, err := h.service.AdjustStock(
		r.Context(),
		organizationID(r),
		userID,
		requestActorName(r),
		productID,
		req,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, product)
}

func (h *Handler) CreateSale(w http.ResponseWriter, r *http.Request) {
	userID, err := requestUserID(r)
	if err != nil {
		writeError(w, err)
		return
	}

	var req CreateSaleRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}

	sellerName, _ := middleware.UserNameFromContext(r.Context())
	if strings.TrimSpace(sellerName) == "" {
		sellerName, _ = middleware.UserEmailFromContext(r.Context())
	}
	result, err := h.service.CreateSale(r.Context(), organizationID(r), userID, sellerName, req)
	if err != nil {
		writeError(w, err)
		return
	}

	status := http.StatusCreated
	if result.Duplicated {
		status = http.StatusOK
	}
	writeJSON(w, status, result)
}

func (h *Handler) ListSales(w http.ResponseWriter, r *http.Request) {
	var bazarID *uuid.UUID
	if rawID := strings.TrimSpace(r.URL.Query().Get("bazar_id")); rawID != "" {
		parsed, err := uuid.Parse(rawID)
		if err != nil {
			writeError(w, &serviceError{Status: http.StatusBadRequest, Message: "ID de bazar inválido."})
			return
		}
		bazarID = &parsed
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	sales, err := h.repo.ListSales(r.Context(), organizationID(r), bazarID, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sales": sales})
}

func (h *Handler) CancelSale(w http.ResponseWriter, r *http.Request) {
	saleID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, &serviceError{Status: http.StatusBadRequest, Message: "ID de venta inválido."})
		return
	}
	userID, err := requestUserID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	role, _ := middleware.UserRoleFromContext(r.Context())
	sale, err := h.service.CancelSale(
		r.Context(),
		organizationID(r),
		saleID,
		userID,
		requestActorName(r),
		role == "admin",
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sale": sale})
}

func (h *Handler) CloseBazar(w http.ResponseWriter, r *http.Request) {
	bazarID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, &serviceError{Status: http.StatusBadRequest, Message: "ID de bazar inválido."})
		return
	}
	userID, err := requestUserID(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var req CloseBazarRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}
	closed, err := h.service.CloseBazar(
		r.Context(),
		organizationID(r),
		bazarID,
		userID,
		requestActorName(r),
		req,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	report, err := h.service.FinalBazarReport(r.Context(), organizationID(r), bazarID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"bazar": closed, "report": report})
}

func (h *Handler) GetBazarReport(w http.ResponseWriter, r *http.Request) {
	bazarID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, &serviceError{Status: http.StatusBadRequest, Message: "ID de bazar inválido."})
		return
	}
	report, err := h.service.FinalBazarReport(r.Context(), organizationID(r), bazarID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	var bazarID *uuid.UUID
	if rawID := strings.TrimSpace(r.URL.Query().Get("bazar_id")); rawID != "" {
		parsed, err := uuid.Parse(rawID)
		if err != nil {
			writeError(w, &serviceError{Status: http.StatusBadRequest, Message: "ID de bazar inválido."})
			return
		}
		bazarID = &parsed
	}
	stats, err := h.service.DailyStats(r.Context(), organizationID(r), bazarID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *Handler) GetDailyReport(w http.ResponseWriter, r *http.Request) {
	bazarID, err := optionalUUIDQuery(r, "bazar_id")
	if err != nil {
		writeError(w, err)
		return
	}
	report, err := h.service.Report(
		r.Context(),
		organizationID(r),
		bazarID,
		r.URL.Query().Get("date"),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (h *Handler) ListInventoryMovements(w http.ResponseWriter, r *http.Request) {
	productID, err := optionalUUIDQuery(r, "product_id")
	if err != nil {
		writeError(w, err)
		return
	}
	bazarID, err := optionalUUIDQuery(r, "bazar_id")
	if err != nil {
		writeError(w, err)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.repo.ListInventoryMovements(
		r.Context(),
		organizationID(r),
		productID,
		bazarID,
		limit,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"movements": items})
}

func (h *Handler) ListAudit(w http.ResponseWriter, r *http.Request) {
	bazarID, err := optionalUUIDQuery(r, "bazar_id")
	if err != nil {
		writeError(w, err)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.repo.ListAudit(r.Context(), organizationID(r), bazarID, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"audit": items})
}

func (h *Handler) Sync(w http.ResponseWriter, r *http.Request) {
	var req SyncRequest
	if err := decodeOptionalJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}
	result, err := h.service.SyncAll(r.Context(), organizationID(r), req.ConflictStrategy)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) GetSyncConflicts(w http.ResponseWriter, r *http.Request) {
	conflicts, err := h.service.SyncConflicts(r.Context(), organizationID(r))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"conflicts": conflicts})
}

func (h *Handler) GetSyncStatus(w http.ResponseWriter, r *http.Request) {
	configured, message := h.sheets.Configured()
	status, err := h.repo.GetSyncStatus(r.Context(), organizationID(r), configured, message)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func organizationID(r *http.Request) string {
	value, _ := middleware.OrganizationIDFromContext(r.Context())
	return value
}

func requestUserID(r *http.Request) (uuid.UUID, error) {
	value, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		return uuid.Nil, &serviceError{Status: http.StatusUnauthorized, Message: "Sesión no válida."}
	}
	parsed, err := uuid.Parse(value)
	if err != nil {
		return uuid.Nil, &serviceError{Status: http.StatusUnauthorized, Message: "Usuario no válido."}
	}
	return parsed, nil
}

func requestActorName(r *http.Request) string {
	name, _ := middleware.UserNameFromContext(r.Context())
	if strings.TrimSpace(name) != "" {
		return name
	}
	email, _ := middleware.UserEmailFromContext(r.Context())
	if strings.TrimSpace(email) != "" {
		return email
	}
	return "Usuario"
}

func optionalUUIDQuery(r *http.Request, name string) (*uuid.UUID, error) {
	value := strings.TrimSpace(r.URL.Query().Get(name))
	if value == "" {
		return nil, nil
	}
	parsed, err := uuid.Parse(value)
	if err != nil {
		return nil, &serviceError{Status: http.StatusBadRequest, Message: name + " no es válido."}
	}
	return &parsed, nil
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return &serviceError{Status: http.StatusBadRequest, Message: "La solicitud contiene datos inválidos."}
	}
	return nil
}

func decodeOptionalJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil && err != io.EOF {
		return &serviceError{Status: http.StatusBadRequest, Message: "La solicitud contiene datos inválidos."}
	}
	return nil
}

func writeError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	message := "No se pudo completar la operación."
	var domainError *serviceError
	if errors.As(err, &domainError) {
		status = domainError.Status
		message = domainError.Message
	}
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
