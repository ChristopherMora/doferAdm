package transport

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/dofer/panel-api/internal/modules/quotes/app"
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type QuoteHandler struct {
	createHandler         *app.CreateQuoteHandler
	getHandler            *app.GetQuoteHandler
	listHandler           *app.ListQuotesHandler
	addItemHandler        *app.AddQuoteItemHandler
	updateHandler         *app.UpdateQuoteHandler
	updateStatusHandler   *app.UpdateQuoteStatusHandler
	deleteItemHandler     *app.DeleteQuoteItemHandler
	deleteQuoteHandler    *app.DeleteQuoteHandler
	searchHandler         *app.SearchQuotesHandler
	convertToOrderHandler *app.ConvertToOrderHandler
	addPaymentHandler     *app.AddPaymentHandler
	syncItemsHandler      *app.SyncItemsToOrderHandler
	createTemplateHandler *app.CreateQuoteTemplateHandler
	getTemplateHandler    *app.GetQuoteTemplateHandler
	listTemplateHandler   *app.ListQuoteTemplatesHandler
	updateTemplateHandler *app.UpdateQuoteTemplateHandler
	deleteTemplateHandler *app.DeleteQuoteTemplateHandler
}

func NewQuoteHandler(
	createHandler *app.CreateQuoteHandler,
	getHandler *app.GetQuoteHandler,
	listHandler *app.ListQuotesHandler,
	addItemHandler *app.AddQuoteItemHandler,
	updateHandler *app.UpdateQuoteHandler,
	updateStatusHandler *app.UpdateQuoteStatusHandler,
	deleteItemHandler *app.DeleteQuoteItemHandler,
	deleteQuoteHandler *app.DeleteQuoteHandler,
	searchHandler *app.SearchQuotesHandler,
	convertToOrderHandler *app.ConvertToOrderHandler,
	addPaymentHandler *app.AddPaymentHandler,
	syncItemsHandler *app.SyncItemsToOrderHandler,
	createTemplateHandler *app.CreateQuoteTemplateHandler,
	getTemplateHandler *app.GetQuoteTemplateHandler,
	listTemplateHandler *app.ListQuoteTemplatesHandler,
	updateTemplateHandler *app.UpdateQuoteTemplateHandler,
	deleteTemplateHandler *app.DeleteQuoteTemplateHandler,
) *QuoteHandler {
	return &QuoteHandler{
		createHandler:         createHandler,
		getHandler:            getHandler,
		listHandler:           listHandler,
		addItemHandler:        addItemHandler,
		updateHandler:         updateHandler,
		updateStatusHandler:   updateStatusHandler,
		deleteItemHandler:     deleteItemHandler,
		deleteQuoteHandler:    deleteQuoteHandler,
		searchHandler:         searchHandler,
		convertToOrderHandler: convertToOrderHandler,
		addPaymentHandler:     addPaymentHandler,
		syncItemsHandler:      syncItemsHandler,
		createTemplateHandler: createTemplateHandler,
		getTemplateHandler:    getTemplateHandler,
		listTemplateHandler:   listTemplateHandler,
		updateTemplateHandler: updateTemplateHandler,
		deleteTemplateHandler: deleteTemplateHandler,
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
	MaterialName   string   `json:"material_name"`
	UnitPrice      *float64 `json:"unit_price"` // Precio personalizado (opcional)
}

type UpdateQuoteStatusRequest struct {
	Status string `json:"status"`
}

type UpdateQuoteRequest struct {
	CustomerName  *string `json:"customer_name"`
	CustomerEmail *string `json:"customer_email"`
	CustomerPhone *string `json:"customer_phone"`
	Notes         *string `json:"notes"`
}

type AddPaymentRequest struct {
	Amount float64 `json:"amount"`
}

type CreateQuoteTemplateRequest struct {
	Name             string  `json:"name"`
	Description      string  `json:"description"`
	Material         string  `json:"material"`
	InfillPercentage float64 `json:"infill_percentage"`
	LayerHeight      float64 `json:"layer_height"`
	PrintSpeed       float64 `json:"print_speed"`
	BaseCost         float64 `json:"base_cost"`
	MarkupPercentage float64 `json:"markup_percentage"`
}

type UpdateQuoteTemplateRequest struct {
	Name             *string  `json:"name,omitempty"`
	Description      *string  `json:"description,omitempty"`
	Material         *string  `json:"material,omitempty"`
	InfillPercentage *float64 `json:"infill_percentage,omitempty"`
	LayerHeight      *float64 `json:"layer_height,omitempty"`
	PrintSpeed       *float64 `json:"print_speed,omitempty"`
	BaseCost         *float64 `json:"base_cost,omitempty"`
	MarkupPercentage *float64 `json:"markup_percentage,omitempty"`
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

	createdBy, ok := middleware.UserIDFromContext(r.Context())
	if !ok || strings.TrimSpace(createdBy) == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	cmd := app.CreateQuoteCommand{
		CustomerName:  req.CustomerName,
		CustomerEmail: req.CustomerEmail,
		CustomerPhone: req.CustomerPhone,
		Notes:         req.Notes,
		ValidUntil:    time.Now().AddDate(0, 0, validDays),
		CreatedBy:     createdBy,
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
		MaterialName:   req.MaterialName,
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

func (h *QuoteHandler) UpdateQuote(w http.ResponseWriter, r *http.Request) {
	quoteID := chi.URLParam(r, "id")

	var req UpdateQuoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	cmd := app.UpdateQuoteCommand{
		QuoteID:       quoteID,
		CustomerName:  req.CustomerName,
		CustomerEmail: req.CustomerEmail,
		CustomerPhone: req.CustomerPhone,
		Notes:         req.Notes,
	}

	quote, err := h.updateHandler.Handle(r.Context(), cmd)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Quote updated successfully",
		"quote":   quote,
	})
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

func (h *QuoteHandler) ConvertToOrder(w http.ResponseWriter, r *http.Request) {
	quoteID := chi.URLParam(r, "id")

	cmd := app.ConvertToOrderCommand{
		QuoteID: quoteID,
	}

	order, err := h.convertToOrderHandler.Handle(r.Context(), cmd)
	if err != nil {
		if err == app.ErrQuoteNotApproved {
			http.Error(w, "La cotización debe estar aprobada para convertirla en pedido", http.StatusBadRequest)
			return
		}
		if err == app.ErrQuoteNoItems {
			http.Error(w, "La cotización debe tener al menos un item", http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"order":   order,
		"message": "Cotización convertida a pedido exitosamente",
	})
}

func (h *QuoteHandler) AddPayment(w http.ResponseWriter, r *http.Request) {
	quoteID := chi.URLParam(r, "id")

	var req AddPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	cmd := app.AddPaymentCommand{
		QuoteID: quoteID,
		Amount:  req.Amount,
	}

	quote, err := h.addPaymentHandler.Handle(r.Context(), cmd)
	if err != nil {
		if err == app.ErrInvalidPaymentAmount {
			http.Error(w, "El monto del pago debe ser mayor a 0", http.StatusBadRequest)
			return
		}
		if err == app.ErrPaymentExceedsBalance {
			http.Error(w, "El monto del pago excede el saldo pendiente", http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"quote":   quote,
		"message": "Pago registrado exitosamente",
	})
}

// SyncItemsToOrder sincroniza items de cotización a pedido existente
func (h *QuoteHandler) SyncItemsToOrder(w http.ResponseWriter, r *http.Request) {
	quoteID := chi.URLParam(r, "id")

	cmd := app.SyncItemsToOrderCommand{
		QuoteID: quoteID,
	}

	err := h.syncItemsHandler.Handle(r.Context(), cmd)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Items sincronizados al pedido exitosamente",
	})
}

func (h *QuoteHandler) ListQuoteTemplates(w http.ResponseWriter, r *http.Request) {
	templates, err := h.listTemplateHandler.Handle(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"templates": templates,
		"total":     len(templates),
	})
}

func (h *QuoteHandler) GetQuoteTemplate(w http.ResponseWriter, r *http.Request) {
	templateID := chi.URLParam(r, "templateId")

	template, err := h.getTemplateHandler.Handle(r.Context(), templateID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if template == nil {
		http.Error(w, "template not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(template)
}

func (h *QuoteHandler) CreateQuoteTemplate(w http.ResponseWriter, r *http.Request) {
	var req CreateQuoteTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Material == "" {
		req.Material = "PLA"
	}
	if req.LayerHeight == 0 {
		req.LayerHeight = 0.2
	}
	if req.PrintSpeed == 0 {
		req.PrintSpeed = 50
	}

	createdBy, _ := middleware.UserIDFromContext(r.Context())
	cmd := app.CreateQuoteTemplateCommand{
		Name:             req.Name,
		Description:      req.Description,
		Material:         req.Material,
		InfillPercentage: req.InfillPercentage,
		LayerHeight:      req.LayerHeight,
		PrintSpeed:       req.PrintSpeed,
		BaseCost:         req.BaseCost,
		MarkupPercentage: req.MarkupPercentage,
		CreatedBy:        createdBy,
	}

	template, err := h.createTemplateHandler.Handle(r.Context(), cmd)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(template)
}

func (h *QuoteHandler) UpdateQuoteTemplate(w http.ResponseWriter, r *http.Request) {
	templateID := chi.URLParam(r, "templateId")

	var req UpdateQuoteTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	cmd := app.UpdateQuoteTemplateCommand{
		TemplateID:       templateID,
		Name:             req.Name,
		Description:      req.Description,
		Material:         req.Material,
		InfillPercentage: req.InfillPercentage,
		LayerHeight:      req.LayerHeight,
		PrintSpeed:       req.PrintSpeed,
		BaseCost:         req.BaseCost,
		MarkupPercentage: req.MarkupPercentage,
	}

	template, err := h.updateTemplateHandler.Handle(r.Context(), cmd)
	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "template not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(template)
}

func (h *QuoteHandler) DeleteQuoteTemplate(w http.ResponseWriter, r *http.Request) {
	templateID := chi.URLParam(r, "templateId")

	cmd := app.DeleteQuoteTemplateCommand{
		TemplateID: templateID,
	}

	if err := h.deleteTemplateHandler.Handle(r.Context(), cmd); err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "template not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Template deleted successfully"})
}
