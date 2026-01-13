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
		r.Get("/{id}/history", handler.GetOrderHistory)
		r.Patch("/{id}/status", handler.UpdateOrderStatus)
		r.Patch("/{id}/assign", handler.AssignOrder)
		r.Get("/{id}", handler.GetOrder)
	})
}
