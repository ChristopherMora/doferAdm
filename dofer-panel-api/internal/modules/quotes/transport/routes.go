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
		r.Get("/search", handler.SearchQuotes)

		// Rutas anidadas con {id}
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", handler.GetQuote)
			r.Delete("/", handler.DeleteQuote)
			r.Patch("/", handler.UpdateQuote)
			r.Patch("/status", handler.UpdateQuoteStatus)
			r.Post("/convert-to-order", handler.ConvertToOrder)

			// Items dentro de quote
			r.Post("/items", handler.AddQuoteItem)
			r.Delete("/items/{itemId}", handler.DeleteQuoteItem)
		})
	})
}
