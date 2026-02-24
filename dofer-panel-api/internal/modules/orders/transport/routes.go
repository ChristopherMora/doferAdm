package transport

import (
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, handler *OrderHandler) {
	r.Route("/orders", func(r chi.Router) {
		r.Use(middleware.RequireAuth)

		r.Post("/", handler.CreateOrder)
		r.Get("/", handler.ListOrders)
		// Rutas específicas antes de rutas genéricas con parámetros
		r.Get("/stats", handler.GetOrderStats)
		r.Get("/search", handler.SearchOrders)
		r.Get("/operator-stats", handler.GetOperatorStats)
		r.Post("/bulk/status", handler.BulkUpdateOrderStatus)
		r.Post("/bulk/priority", handler.BulkUpdateOrderPriority)
		r.Post("/sla-reminders", handler.SendSLAReminders)
		r.Get("/{id}/history", handler.GetOrderHistory)
		r.Patch("/{id}/status", handler.UpdateOrderStatus)
		r.Patch("/{id}/priority", handler.UpdateOrderPriority)
		r.Patch("/{id}/assign", handler.AssignOrder)
		// Items endpoints
		r.Get("/{id}/items", handler.GetOrderItems)
		r.Post("/{id}/items", handler.AddOrderItem)
		r.Patch("/{id}/items/{itemId}/status", handler.UpdateOrderItemStatus)
		r.Delete("/{id}/items/{itemId}", handler.DeleteOrderItem)
		// Payment endpoints
		r.Get("/{id}/payments", handler.GetOrderPayments)
		r.Post("/{id}/payments", handler.AddOrderPayment)
		r.Delete("/{id}/payments/{paymentId}", handler.DeleteOrderPayment)
		// Timer endpoints
		r.Get("/{id}/timer", handler.GetTimer)
		r.Post("/{id}/timer/start", handler.StartTimer)
		r.Post("/{id}/timer/pause", handler.PauseTimer)
		r.Post("/{id}/timer/stop", handler.StopTimer)
		r.Patch("/{id}/estimated-time", handler.UpdateEstimatedTime)
		// Recalculate totals endpoint
		r.Post("/{id}/recalculate", handler.RecalculateOrderTotals)
		r.Get("/{id}", handler.GetOrder)
	})
}
