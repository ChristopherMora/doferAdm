package transport

import (
	"encoding/json"
	"fmt"
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
	deleteItemHandler   *app.DeleteQuoteItemHandler
	deleteQuoteHandler  *app.DeleteQuoteHandler
	searchHandler       *app.SearchQuotesHandler
}

func NewQuoteHandler(
	createHandler *app.CreateQuoteHandler,
	getHandler *app.GetQuoteHandler,
	listHandler *app.ListQuotesHandler,
	addItemHandler *app.AddQuoteItemHandler,
	updateStatusHandler *app.UpdateQuoteStatusHandler,
	deleteItemHandler *app.DeleteQuoteItemHandler,
	deleteQuoteHandler *app.DeleteQuoteHandler,
	searchHandler *app.SearchQuotesHandler,
) *QuoteHandler {
	return &QuoteHandler{
		createHandler:       createHandler,
		getHandler:          getHandler,
		listHandler:         listHandler,
		addItemHandler:      addItemHandler,
		updateStatusHandler: updateStatusHandler,
		deleteItemHandler:   deleteItemHandler,
		deleteQuoteHandler:  deleteQuoteHandler,
		searchHandler:       searchHandler,
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
	ProductName    string   `json:"product_name"`
	Description    string   `json:"description"`
	WeightGrams    float64  `json:"weight_grams"`
	PrintTimeHours float64  `json:"print_time_hours"`
	Quantity       int      `json:"quantity"`
	OtherCosts     float64  `json:"other_costs"`
	UnitPrice      *float64 `json:"unit_price"` // Precio personalizado (opcional)
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
		CustomPrice:    req.UnitPrice, // Pasar precio personalizado si existe
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
func (h *QuoteHandler) DeleteQuoteItem(w http.ResponseWriter, r *http.Request) {
	quoteID := chi.URLParam(r, "id")
	itemID := chi.URLParam(r, "itemId")

	if quoteID == "" || itemID == "" {
		http.Error(w, "Invalid quote ID or item ID", http.StatusBadRequest)
		return
	}

	cmd := app.DeleteQuoteItemCommand{
		QuoteID: quoteID,
		ItemID:  itemID,
	}

	if err := h.deleteItemHandler.Handle(r.Context(), cmd); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Item deleted successfully"})
}

func (h *QuoteHandler) DeleteQuote(w http.ResponseWriter, r *http.Request) {
	quoteID := chi.URLParam(r, "id")

	cmd := app.DeleteQuoteCommand{
		QuoteID: quoteID,
	}

	if err := h.deleteQuoteHandler.Handle(r.Context(), cmd); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Quote deleted successfully"})
}

func (h *QuoteHandler) SearchQuotes(w http.ResponseWriter, r *http.Request) {
	// Parse min/max total from query params
	var minTotal, maxTotal float64
	if minStr := r.URL.Query().Get("min_total"); minStr != "" {
		fmt.Sscanf(minStr, "%f", &minTotal)
	}
	if maxStr := r.URL.Query().Get("max_total"); maxStr != "" {
		fmt.Sscanf(maxStr, "%f", &maxTotal)
	}

	params := app.SearchQuotesParams{
		Query:    r.URL.Query().Get("query"),
		Status:   r.URL.Query().Get("status"),
		Customer: r.URL.Query().Get("customer"),
		DateFrom: r.URL.Query().Get("date_from"),
		DateTo:   r.URL.Query().Get("date_to"),
		MinTotal: minTotal,
		MaxTotal: maxTotal,
	}

	quotes, err := h.searchHandler.Handle(r.Context(), params)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"quotes": quotes,
		"total":  len(quotes),
	})
}
