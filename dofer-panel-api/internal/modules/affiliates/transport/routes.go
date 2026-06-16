package transport

import (
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
)

// RegisterRoutes registra las rutas del módulo de afiliados. El control de
// acceso vive siempre en el middleware RequireRole (nunca en lógica
// condicional dentro de los handlers): cada bloque r.Route de abajo aplica
// un único rol permitido a todas sus subrutas.
func RegisterRoutes(r chi.Router, handler *AffiliateHandler) {
	// Gestión de afiliados (admin/operator) — CRUD + vistas anidadas por afiliado.
	r.Route("/affiliates", func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Use(middleware.RequireRole("admin", "operator"))

		r.Post("/", handler.CreateAffiliate)
		r.Get("/", handler.ListAffiliates)

		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", handler.GetAffiliate)
			r.Put("/", handler.UpdateAffiliate)
			r.Patch("/account/email", handler.UpdateAffiliateEmail)
			r.Patch("/account/password", handler.ResetAffiliatePassword)
			r.Get("/stats", handler.GetAffiliateStats)
			r.Get("/requests", handler.ListAffiliateRequests)
			r.Get("/commissions", handler.ListAffiliateCommissions)
		})
	})

	// Auto-servicio del afiliado: registrado en su propio r.Route con
	// RequireRole("affiliate") para que nunca colisione con /affiliates/{id}
	// (chi prioriza el segmento estático "me" sobre el parámetro {id}).
	r.Route("/affiliates/me", func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Use(middleware.RequireRole("affiliate"))

		r.Get("/", handler.GetMyProfile)
		r.Get("/products", handler.ListMyAvailableProducts)
		r.Get("/requests", handler.ListMyOrderRequests)
		r.Post("/requests", handler.CreateMyOrderRequest)
		r.Get("/requests/{id}", handler.GetMyOrderRequestDetail)
		r.Put("/requests/{id}", handler.UpdateMyOrderRequest)
		r.Patch("/requests/{id}/cancel", handler.CancelMyOrderRequest)
		r.Post("/requests/{id}/comments", handler.CreateMyOrderRequestComment)
		r.Get("/commissions", handler.ListMyCommissions)
	})

	// Bandeja global de solicitudes (admin/operator) — pantalla principal de revisión.
	r.Route("/affiliate-requests", func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Use(middleware.RequireRole("admin", "operator"))

		r.Get("/", handler.ListAllOrderRequests)
		r.Get("/{id}", handler.GetOrderRequest)
		r.Get("/{id}/detail", handler.GetOrderRequestDetail)
		r.Patch("/{id}/approve", handler.ApproveOrderRequest)
		r.Patch("/{id}/reject", handler.RejectOrderRequest)
		r.Patch("/{id}/changes", handler.RequestOrderRequestChanges)
		r.Patch("/{id}/operations", handler.UpdateOrderRequestOperations)
		r.Post("/{id}/comments", handler.CreateOrderRequestComment)
	})

	// Comisiones, vista global (admin/operator).
	r.Route("/affiliate-commissions", func(r chi.Router) {
		r.Use(middleware.RequireAuth)
		r.Use(middleware.RequireRole("admin", "operator"))

		r.Get("/", handler.ListAllCommissions)
		r.Patch("/pay-batch", handler.PayCommissionsBatch)
		r.Patch("/{id}/pay", handler.PayCommission)
	})
}
