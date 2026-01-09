package transport

import (
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, handler *CostHandler) {
	r.Route("/costs", func(r chi.Router) {
		r.Use(middleware.RequireAuth)

		r.Get("/settings", handler.GetCostSettings)
		r.Put("/settings", handler.UpdateCostSettings)
		r.Post("/calculate", handler.CalculateCost)
	})
}
