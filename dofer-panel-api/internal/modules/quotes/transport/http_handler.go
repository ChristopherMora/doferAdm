package transport

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/dofer/panel-api/internal/modules/quotes/app"
	"github.com/go-chi/chi/v5"
)

type QuoteHandler struct {
	createHandler       *app.CreateQuoteHandler
	getHandler          *app.GetQuoteHandler
	listHandler         *app.ListQuotesHandler
	addItemHandler      *app.AddQuoteItemHandler
	updateStatusHandler *app.UpdateQuoteStatusHandler
}

func NewQuoteHandler(
	createHandler *app.CreateQuoteHandler,
	getHandler *app.GetQuoteHandler,
	listHandler *app.ListQuotesHandler,
	addItemHandler *app.AddQuoteItemHandler,
	updateStatusHandler *app.UpdateQuoteStatusHandler,
) *QuoteHandler {
	return &QuoteHandler{
		createHandler:       createHandler,
		getHandler:          getHandler,
		listHandler:         listHandler,
		addItemHandler:      addItemHandler,
		updateStatusHandler: updateStatusHandler,
	}
}

type CreateQuoteRequest struct {
	CustomerName  string `json:"customer_name"`
	CustomerEmail string `json:"customer_email"`
	CustomerPhone string `json:"customer_phone"`
	Notes         string `json:"notes"`
	ValidDays     int    `json:"valid_days"` // Días de validez desde hoy
}

type AddQuoteItemRequest struct {
	ProductName    string  `json:"product_name"`
	Description    string  `json:"description"`
	WeightGrams    float64 `json:"weight_grams"`
	PrintTimeHours float64 `json:"print_time_hours"`
	Quantity       int     `json:"quantity"`
	OtherCosts     float64 `json:"other_costs"`
}

type UpdateQuoteStatusRequest struct {
	Status string `json:"status"`
}

func (h *QuoteHandler) CreateQuote(w http.ResponseWriter, r *http.Request) {
	var req CreateQuoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	validDays := req.ValidDays
	if validDays == 0 {
		validDays = 15 // Por defecto 15 días
	}

	cmd := app.CreateQuoteCommand{
		CustomerName:  req.CustomerName,
		CustomerEmail: req.CustomerEmail,
		CustomerPhone: req.CustomerPhone,
		Notes:         req.Notes,
		ValidUntil:    time.Now().AddDate(0, 0, validDays),
		CreatedBy:     "11111111-1111-1111-1111-111111111111", // Admin user UUID
	}

	quote, err := h.createHandler.Handle(r.Context(), cmd)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(quote)
}

func (h *QuoteHandler) GetQuote(w http.ResponseWriter, r *http.Request) {
	quoteID := chi.URLParam(r, "id")

	quote, items, err := h.getHandler.Handle(r.Context(), quoteID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	response := map[string]interface{}{
		"quote": quote,
		"items": items,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *QuoteHandler) ListQuotes(w http.ResponseWriter, r *http.Request) {
	quotes, err := h.listHandler.Handle(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"quotes": quotes,
		"total":  len(quotes),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *QuoteHandler) AddQuoteItem(w http.ResponseWriter, r *http.Request) {
	quoteID := chi.URLParam(r, "id")

	var req AddQuoteItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	cmd := app.AddQuoteItemCommand{
		QuoteID:        quoteID,
		ProductName:    req.ProductName,
		Description:    req.Description,
		WeightGrams:    req.WeightGrams,
		PrintTimeHours: req.PrintTimeHours,
		Quantity:       req.Quantity,
		OtherCosts:     req.OtherCosts,
	}

	if err := h.addItemHandler.Handle(r.Context(), cmd); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Item added successfully"})
}

func (h *QuoteHandler) UpdateQuoteStatus(w http.ResponseWriter, r *http.Request) {
	quoteID := chi.URLParam(r, "id")

	var req UpdateQuoteStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	cmd := app.UpdateQuoteStatusCommand{
		QuoteID: quoteID,
		Status:  req.Status,
	}

	if err := h.updateStatusHandler.Handle(r.Context(), cmd); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Status updated successfully"})
}
