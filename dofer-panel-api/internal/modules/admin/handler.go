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

		r.Get("/organizations", h.ListOrganizations)
		r.Get("/organization", h.GetOrganization)
		r.Put("/organization", h.UpdateOrganization)
		r.Get("/organization/audit", h.ListAuditLogs)
		r.Get("/organization/user-metrics", h.ListUserMetrics)
		r.Get("/finance/summary", h.GetFinanceSummary)
		r.Get("/finance/payments", h.ListFinancePayments)
		r.Get("/finance/receivables", h.ListReceivables)
		r.Get("/finance/cuts", h.ListFinanceCuts)
	})
}

func organizationIDFromRequest(r *http.Request) (string, bool) {
	return middleware.OrganizationIDFromContext(r.Context())
}

func (h *Handler) ListOrganizations(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	organizations, err := h.repo.ListOrganizationsForUser(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"organizations": organizations,
		"total":         len(organizations),
	})
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

	if actorUserID, ok := middleware.UserIDFromContext(r.Context()); ok {
		_ = h.repo.CreateAuditLog(r.Context(), organizationID, actorUserID, "organization.updated", "organization", organizationID, map[string]interface{}{
			"name": summary.Name,
			"slug": summary.Slug,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (h *Handler) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	logs, err := h.repo.ListAuditLogs(r.Context(), organizationID, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"logs":  logs,
		"total": len(logs),
	})
}

func (h *Handler) ListUserMetrics(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	metrics, err := h.repo.ListUserMetrics(r.Context(), organizationID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"metrics": metrics,
		"total":   len(metrics),
	})
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

func (h *Handler) ListReceivables(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	receivables, err := h.repo.ListReceivables(r.Context(), organizationID, r.URL.Query().Get("status"), limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"receivables": receivables,
		"total":       len(receivables),
	})
}

func (h *Handler) ListFinanceCuts(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	cuts, err := h.repo.ListFinanceCuts(r.Context(), organizationID, r.URL.Query().Get("period"), limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"cuts":  cuts,
		"total": len(cuts),
	})
}
