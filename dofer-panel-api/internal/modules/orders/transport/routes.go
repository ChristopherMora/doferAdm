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
		r.Get("/{id}", handler.GetOrder)
		r.Patch("/{id}/status", handler.UpdateOrderStatus)
		r.Patch("/{id}/assign", handler.AssignOrder)
	})
}
