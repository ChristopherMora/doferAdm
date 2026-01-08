package transport

import (
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, handler *AuthHandler) {
	r.Route("/auth", func(r chi.Router) {
		// Rutas protegidas
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth)
			r.Get("/me", handler.GetMe)
		})
	})
}
