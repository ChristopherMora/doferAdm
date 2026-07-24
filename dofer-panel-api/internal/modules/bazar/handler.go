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
		r.Get("/products", handler.ListProducts)
		r.Get("/products/{id}", handler.GetProduct)
		r.Get("/sales", handler.ListSales)
		r.Get("/stats", handler.GetStats)
		r.Get("/sync/status", handler.GetSyncStatus)

		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireRole("admin", "operator"))
			r.Post("/bazaars", handler.CreateBazar)
			r.Post("/products", handler.CreateProduct)
			r.Post("/sales", handler.CreateSale)
			r.Post("/sales/{id}/cancel", handler.CancelSale)
			r.Post("/sales/{id}/undo", handler.CancelSale)
			r.Post("/sync", handler.Sync)
		})
	})
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
	var req CreateProductRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}

	product, err := h.service.CreateProduct(r.Context(), organizationID(r), req)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, product)
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
		role == "admin",
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sale": sale})
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

func (h *Handler) Sync(w http.ResponseWriter, r *http.Request) {
	result, err := h.service.SyncAll(r.Context(), organizationID(r))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
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

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
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
