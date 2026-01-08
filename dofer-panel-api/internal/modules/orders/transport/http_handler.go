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
	listHandler         *app.ListOrdersHandler
	updateStatusHandler *app.UpdateOrderStatusHandler
	assignHandler       *app.AssignOrderHandler
}

func NewOrderHandler(
	createHandler *app.CreateOrderHandler,
	listHandler *app.ListOrdersHandler,
	updateStatusHandler *app.UpdateOrderStatusHandler,
	assignHandler *app.AssignOrderHandler,
) *OrderHandler {
	return &OrderHandler{
		createHandler:       createHandler,
		listHandler:         listHandler,
		updateStatusHandler: updateStatusHandler,
		assignHandler:       assignHandler,
	}
}

type CreateOrderRequest struct {
	OrderNumber   string `json:"order_number"`
	Platform      string `json:"platform"`
	CustomerName  string `json:"customer_name"`
	CustomerEmail string `json:"customer_email"`
	CustomerPhone string `json:"customer_phone"`
	ProductName   string `json:"product_name"`
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
		OrderNumber:   req.OrderNumber,
		Platform:      req.Platform,
		CustomerName:  req.CustomerName,
		CustomerEmail: req.CustomerEmail,
		CustomerPhone: req.CustomerPhone,
		ProductName:   req.ProductName,
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
		Quantity:      order.Quantity,
		Notes:         order.Notes,
		CreatedAt:     order.CreatedAt,
		UpdatedAt:     order.UpdatedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
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
		OrderID: orderID,
		UserID:  req.UserID,
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
