package admin

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo             *Repository
	passwordVerifier PasswordVerifier
}

func NewHandler(repo *Repository, passwordVerifier PasswordVerifier) *Handler {
	return &Handler{repo: repo, passwordVerifier: passwordVerifier}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Route("/admin", func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Use(middleware.RequireRole("admin"))

		r.Get("/organizations", h.ListOrganizations)
		r.Get("/organization", h.GetOrganization)
		r.Put("/organization", h.UpdateOrganization)
		r.With(middleware.RequirePlatformAdmin).Patch("/organization/subscription", h.UpdateOrganizationSubscription)
		r.Get("/organization/overview", h.GetOrganizationOverview)
		r.Get("/organization/audit", h.ListAuditLogs)
		r.Get("/organization/user-metrics", h.ListUserMetrics)
		r.Get("/finance/summary", h.GetFinanceSummary)
		r.Get("/finance/payments", h.ListFinancePayments)
		r.Get("/finance/receivables", h.ListReceivables)
		r.Get("/finance/cuts", h.ListFinanceCuts)
		r.Get("/finance/incomes", h.ListFinanceIncomes)
		r.Post("/finance/incomes", h.CreateFinanceIncome)
		r.Delete("/finance/incomes/{incomeID}", h.DeleteFinanceIncome)
		r.Get("/finance/expenses", h.ListFinanceExpenses)
		r.Post("/finance/expenses", h.CreateFinanceExpense)
		r.Delete("/finance/expenses/{expenseID}", h.DeleteFinanceExpense)
		r.Post("/finance/clear", h.ClearFinance)
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

func (h *Handler) UpdateOrganizationSubscription(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	var request UpdateOrganizationSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	summary, err := h.repo.UpdateOrganizationSubscription(r.Context(), organizationID, request)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if actorUserID, ok := middleware.UserIDFromContext(r.Context()); ok {
		_ = h.repo.CreateAuditLog(r.Context(), organizationID, actorUserID, "organization.subscription_updated", "organization", organizationID, map[string]interface{}{
			"subscription_plan":    summary.SubscriptionPlan,
			"subscription_status":  summary.SubscriptionStatus,
			"subscription_ends_at": summary.SubscriptionEndsAt,
			"grace_ends_at":        summary.GraceEndsAt,
			"is_access_blocked":    summary.IsAccessBlocked,
			"max_members":          summary.MaxMembers,
			"max_orders_per_month": summary.MaxOrdersPerMonth,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (h *Handler) GetOrganizationOverview(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	overview, err := h.repo.GetOrganizationOverview(r.Context(), organizationID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview)
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

func (h *Handler) ListFinanceExpenses(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	expenses, err := h.repo.ListFinanceExpenses(r.Context(), organizationID, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"expenses": expenses,
		"total":    len(expenses),
	})
}

func (h *Handler) ListFinanceIncomes(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	incomes, err := h.repo.ListFinanceIncomes(r.Context(), organizationID, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"incomes": incomes,
		"total":   len(incomes),
	})
}

func (h *Handler) CreateFinanceIncome(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	var request CreateFinanceIncomeRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	incomeDate, err := parseFinanceMovementDate(request.IncomeDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	actorUserID, _ := middleware.UserIDFromContext(r.Context())
	income, err := h.repo.CreateFinanceIncome(r.Context(), organizationID, actorUserID, request, incomeDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if actorUserID != "" {
		_ = h.repo.CreateAuditLog(r.Context(), organizationID, actorUserID, "finance_external_incomes.created", "finance_external_income", income.ID, map[string]interface{}{
			"amount":      income.Amount,
			"source":      income.Source,
			"description": income.Description,
			"income_date": income.IncomeDate,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(income)
}

func (h *Handler) DeleteFinanceIncome(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	incomeID := strings.TrimSpace(chi.URLParam(r, "incomeID"))
	income, err := h.repo.DeleteFinanceIncome(r.Context(), organizationID, incomeID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if actorUserID, ok := middleware.UserIDFromContext(r.Context()); ok {
		_ = h.repo.CreateAuditLog(r.Context(), organizationID, actorUserID, "finance_external_incomes.deleted", "finance_external_income", income.ID, map[string]interface{}{
			"amount":      income.Amount,
			"source":      income.Source,
			"description": income.Description,
			"income_date": income.IncomeDate,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"message": "Income deleted successfully",
		"income":  income,
	})
}

func (h *Handler) CreateFinanceExpense(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	var request CreateFinanceExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	expenseDate, err := parseFinanceMovementDate(request.ExpenseDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	actorUserID, _ := middleware.UserIDFromContext(r.Context())
	expense, err := h.repo.CreateFinanceExpense(r.Context(), organizationID, actorUserID, request, expenseDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if actorUserID != "" {
		_ = h.repo.CreateAuditLog(r.Context(), organizationID, actorUserID, "finance_expenses.created", "finance_expense", expense.ID, map[string]interface{}{
			"amount":       expense.Amount,
			"category":     expense.Category,
			"description":  expense.Description,
			"expense_date": expense.ExpenseDate,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(expense)
}

func (h *Handler) DeleteFinanceExpense(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	expenseID := strings.TrimSpace(chi.URLParam(r, "expenseID"))
	expense, err := h.repo.DeleteFinanceExpense(r.Context(), organizationID, expenseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if actorUserID, ok := middleware.UserIDFromContext(r.Context()); ok {
		_ = h.repo.CreateAuditLog(r.Context(), organizationID, actorUserID, "finance_expenses.deleted", "finance_expense", expense.ID, map[string]interface{}{
			"amount":       expense.Amount,
			"category":     expense.Category,
			"description":  expense.Description,
			"expense_date": expense.ExpenseDate,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"message": "Expense deleted successfully",
		"expense": expense,
	})
}

func (h *Handler) ClearFinance(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := organizationIDFromRequest(r)
	if !ok {
		http.Error(w, "organization not available", http.StatusForbidden)
		return
	}

	var request ClearFinanceRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(request.Password) == "" {
		http.Error(w, "password is required", http.StatusBadRequest)
		return
	}
	if h.passwordVerifier == nil {
		http.Error(w, "password verification is not configured", http.StatusInternalServerError)
		return
	}

	email, ok := middleware.UserEmailFromContext(r.Context())
	if !ok || strings.TrimSpace(email) == "" {
		http.Error(w, "user email not available", http.StatusUnauthorized)
		return
	}
	if err := h.passwordVerifier.Verify(r.Context(), email, request.Password); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "invalid password") {
			http.Error(w, "invalid password", http.StatusUnauthorized)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	actorUserID, _ := middleware.UserIDFromContext(r.Context())
	settings, err := h.repo.SetFinanceReset(r.Context(), organizationID, actorUserID, request.Reason)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if actorUserID != "" {
		_ = h.repo.CreateAuditLog(r.Context(), organizationID, actorUserID, "finance.cleared", "finance_settings", organizationID, map[string]interface{}{
			"reset_at": settings.ResetAt,
			"reason":   settings.ResetReason,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

func parseFinanceMovementDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Now(), nil
	}

	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed, nil
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 12, 0, 0, 0, time.Local), nil
	}

	return time.Time{}, errors.New("invalid finance date")
}
