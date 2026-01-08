package tracking

import (
	"encoding/json"
	"net/http"

	"github.com/dofer/panel-api/internal/modules/orders/domain"
	"github.com/go-chi/chi/v5"
)

type TrackingHandler struct {
	orderRepo domain.OrderRepository
}

func NewTrackingHandler(orderRepo domain.OrderRepository) *TrackingHandler {
	return &TrackingHandler{orderRepo: orderRepo}
}

type PublicOrderResponse struct {
	OrderNumber  string `json:"order_number"`
	Status       string `json:"status"`
	CustomerName string `json:"customer_name"`
	ProductName  string `json:"product_name"`
	Quantity     int    `json:"quantity"`
	CreatedAt    string `json:"created_at"`
}

func (h *TrackingHandler) GetPublicOrder(w http.ResponseWriter, r *http.Request) {
	publicID := chi.URLParam(r, "public_id")

	order, err := h.orderRepo.FindByPublicID(publicID)
	if err != nil {
		http.Error(w, "order not found", http.StatusNotFound)
		return
	}

	response := PublicOrderResponse{
		OrderNumber:  order.OrderNumber,
		Status:       string(order.Status),
		CustomerName: order.CustomerName,
		ProductName:  order.ProductName,
		Quantity:     order.Quantity,
		CreatedAt:    order.CreatedAt.Format("2006-01-02"),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func RegisterRoutes(r chi.Router, handler *TrackingHandler) {
	r.Route("/public", func(r chi.Router) {
		r.Get("/orders/{public_id}", handler.GetPublicOrder)
	})
}
