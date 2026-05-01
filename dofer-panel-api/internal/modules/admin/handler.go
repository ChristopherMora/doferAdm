package admin

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Route("/admin", func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Use(middleware.RequireRole("admin"))

		r.Get("/organization", h.GetOrganization)
		r.Put("/organization", h.UpdateOrganization)
		r.Get("/finance/summary", h.GetFinanceSummary)
		r.Get("/finance/payments", h.ListFinancePayments)
	})
}

func organizationIDFromRequest(r *http.Request) (string, bool) {
	return middleware.OrganizationIDFromContext(r.Context())
}

func (h *Handler) GetOrganization(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	summary, err := h.repo.GetOrganizationSummary(r.Context(), organizationID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (h *Handler) UpdateOrganization(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	var request UpdateOrganizationRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	summary, err := h.repo.UpdateOrganization(r.Context(), organizationID, request)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (h *Handler) GetFinanceSummary(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	summary, err := h.repo.GetFinanceSummary(r.Context(), organizationID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (h *Handler) ListFinancePayments(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	payments, err := h.repo.ListFinancePayments(r.Context(), organizationID, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"payments": payments,
		"total":    len(payments),
	})
}
