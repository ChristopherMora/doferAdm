package transport

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/dofer/panel-api/internal/modules/orders/app"
	"github.com/go-chi/chi/v5"
)

type OrderHandler struct {
	createHandler       *app.CreateOrderHandler
	getHandler          *app.GetOrderHandler
	listHandler         *app.ListOrdersHandler
	updateStatusHandler *app.UpdateOrderStatusHandler
	assignHandler       *app.AssignOrderHandler
	historyHandler      *app.GetOrderHistoryHandler
	statsHandler        *app.GetOrderStatsHandler
}

func NewOrderHandler(
	createHandler *app.CreateOrderHandler,
	getHandler *app.GetOrderHandler,
	listHandler *app.ListOrdersHandler,
	updateStatusHandler *app.UpdateOrderStatusHandler,
	assignHandler *app.AssignOrderHandler,
	historyHandler *app.GetOrderHistoryHandler,
	statsHandler *app.GetOrderStatsHandler,
) *OrderHandler {
	return &OrderHandler{
		createHandler:       createHandler,
		getHandler:          getHandler,
		listHandler:         listHandler,
		updateStatusHandler: updateStatusHandler,
		assignHandler:       assignHandler,
		historyHandler:      historyHandler,
		statsHandler:        statsHandler,
	}
}

type CreateOrderRequest struct {
	Platform      string `json:"platform"`
	CustomerName  string `json:"customer_name"`
	CustomerEmail string `json:"customer_email"`
	CustomerPhone string `json:"customer_phone"`
	ProductName   string `json:"product_name"`
	ProductImage  string `json:"product_image"`
	PrintFile     string `json:"print_file"`
	PrintFileName string `json:"print_file_name"`
	Quantity      int    `json:"quantity"`
	Priority      string `json:"priority"`
	Notes         string `json:"notes"`
}

type OrderResponse struct {
	ID            string     `json:"id"`
	PublicID      string     `json:"public_id"`
	OrderNumber   string     `json:"order_number"`
	Platform      string     `json:"platform"`
	Status        string     `json:"status"`
	Priority      string     `json:"priority"`
	CustomerName  string     `json:"customer_name"`
	CustomerEmail string     `json:"customer_email"`
	CustomerPhone string     `json:"customer_phone"`
	ProductName   string     `json:"product_name"`
	ProductImage  string     `json:"product_image"`
	PrintFile     string     `json:"print_file,omitempty"`
	PrintFileName string     `json:"print_file_name,omitempty"`
	Quantity      int        `json:"quantity"`
	Notes         string     `json:"notes"`
	AssignedTo    string     `json:"assigned_to,omitempty"`
	AssignedAt    *time.Time `json:"assigned_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
}

func (h *OrderHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	order, err := h.createHandler.Handle(r.Context(), app.CreateOrderCommand{
		Platform:      req.Platform,
		CustomerName:  req.CustomerName,
		CustomerEmail: req.CustomerEmail,
		CustomerPhone: req.CustomerPhone,
		ProductName:   req.ProductName,
		ProductImage:  req.ProductImage,
		PrintFile:     req.PrintFile,
		PrintFileName: req.PrintFileName,
		Quantity:      req.Quantity,
		Priority:      req.Priority,
		Notes:         req.Notes,
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	response := OrderResponse{
		ID:            order.ID,
		PublicID:      order.PublicID,
		OrderNumber:   order.OrderNumber,
		Platform:      string(order.Platform),
		Status:        string(order.Status),
		Priority:      string(order.Priority),
		CustomerName:  order.CustomerName,
		CustomerEmail: order.CustomerEmail,
		CustomerPhone: order.CustomerPhone,
		ProductName:   order.ProductName,
		ProductImage:  order.ProductImage,
		PrintFile:     order.PrintFile,
		PrintFileName: order.PrintFileName,
		Quantity:      order.Quantity,
		Notes:         order.Notes,
		CreatedAt:     order.CreatedAt,
		UpdatedAt:     order.UpdatedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

func (h *OrderHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")

	order, err := h.getHandler.Handle(r.Context(), app.GetOrderQuery{
		OrderID: orderID,
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	response := OrderResponse{
		ID:            order.ID,
		PublicID:      order.PublicID,
		OrderNumber:   order.OrderNumber,
		Platform:      string(order.Platform),
		Status:        string(order.Status),
		Priority:      string(order.Priority),
		CustomerName:  order.CustomerName,
		CustomerEmail: order.CustomerEmail,
		CustomerPhone: order.CustomerPhone,
		ProductName:   order.ProductName,
		ProductImage:  order.ProductImage,
		PrintFile:     order.PrintFile,
		PrintFileName: order.PrintFileName,
		Quantity:      order.Quantity,
		Notes:         order.Notes,
		AssignedTo:    order.AssignedTo,
		AssignedAt:    order.AssignedAt,
		CreatedAt:     order.CreatedAt,
		UpdatedAt:     order.UpdatedAt,
		CompletedAt:   order.CompletedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *OrderHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	platform := r.URL.Query().Get("platform")
	assignedTo := r.URL.Query().Get("assigned_to")

	orders, err := h.listHandler.Handle(r.Context(), app.ListOrdersQuery{
		Status:     status,
		Platform:   platform,
		AssignedTo: assignedTo,
		Limit:      50,
		Offset:     0,
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	responses := make([]OrderResponse, len(orders))
	for i, order := range orders {
		responses[i] = OrderResponse{
			ID:            order.ID,
			PublicID:      order.PublicID,
			OrderNumber:   order.OrderNumber,
			Platform:      string(order.Platform),
			Status:        string(order.Status),
			Priority:      string(order.Priority),
			CustomerName:  order.CustomerName,
			CustomerEmail: order.CustomerEmail,
			CustomerPhone: order.CustomerPhone,
			ProductName:   order.ProductName,
			ProductImage:  order.ProductImage,
			PrintFile:     order.PrintFile,
			PrintFileName: order.PrintFileName,
			Quantity:      order.Quantity,
			Notes:         order.Notes,
			AssignedTo:    order.AssignedTo,
			AssignedAt:    order.AssignedAt,
			CreatedAt:     order.CreatedAt,
			UpdatedAt:     order.UpdatedAt,
			CompletedAt:   order.CompletedAt,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"orders": responses,
		"total":  len(responses),
	})
}

type UpdateStatusRequest struct {
	Status string `json:"status"`
}

func (h *OrderHandler) UpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")

	var req UpdateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	order, err := h.updateStatusHandler.Handle(r.Context(), app.UpdateOrderStatusCommand{
		OrderID:   orderID,
		NewStatus: req.Status,
		ChangedBy: "admin",
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	response := OrderResponse{
		ID:          order.ID,
		PublicID:    order.PublicID,
		OrderNumber: order.OrderNumber,
		Status:      string(order.Status),
		UpdatedAt:   order.UpdatedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

type AssignOrderRequest struct {
	UserID string `json:"user_id"`
}

func (h *OrderHandler) AssignOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")

	var req AssignOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	order, err := h.assignHandler.Handle(r.Context(), app.AssignOrderCommand{
		OrderID:   orderID,
		UserID:    req.UserID,
		ChangedBy: "admin",
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	response := OrderResponse{
		ID:         order.ID,
		AssignedTo: order.AssignedTo,
		AssignedAt: order.AssignedAt,
		UpdatedAt:  order.UpdatedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

type HistoryEntryResponse struct {
	ID         string    `json:"id"`
	OrderID    string    `json:"order_id"`
	ChangedBy  string    `json:"changed_by"`
	ChangeType string    `json:"change_type"`
	FieldName  string    `json:"field_name"`
	OldValue   string    `json:"old_value"`
	NewValue   string    `json:"new_value"`
	CreatedAt  time.Time `json:"created_at"`
}

func (h *OrderHandler) GetOrderHistory(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")

	entries, err := h.historyHandler.Handle(r.Context(), app.GetOrderHistoryQuery{
		OrderID: orderID,
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var responses []HistoryEntryResponse
	for _, entry := range entries {
		responses = append(responses, HistoryEntryResponse{
			ID:         entry.ID,
			OrderID:    entry.OrderID,
			ChangedBy:  entry.ChangedBy,
			ChangeType: entry.ChangeType,
			FieldName:  entry.FieldName,
			OldValue:   entry.OldValue,
			NewValue:   entry.NewValue,
			CreatedAt:  entry.CreatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"history": responses,
		"total":   len(responses),
	})
}

func (h *OrderHandler) GetOrderStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.statsHandler.Handle(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
