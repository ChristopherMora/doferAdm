package transport

import (
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, handler *QuoteHandler) {
	r.Route("/quotes", func(r chi.Router) {
		r.Use(middleware.RequireAuth)

		r.Post("/", handler.CreateQuote)
		r.Get("/", handler.ListQuotes)
		r.Get("/{id}", handler.GetQuote)
		r.Post("/{id}/items", handler.AddQuoteItem)
		r.Patch("/{id}/status", handler.UpdateQuoteStatus)
	})
}
