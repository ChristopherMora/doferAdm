package router

import (
	"encoding/json"
	"net/http"

	"github.com/dofer/panel-api/internal/modules/auth/app"
	authInfra "github.com/dofer/panel-api/internal/modules/auth/infra"
	authTransport "github.com/dofer/panel-api/internal/modules/auth/transport"
	ordersApp "github.com/dofer/panel-api/internal/modules/orders/app"
	ordersInfra "github.com/dofer/panel-api/internal/modules/orders/infra"
	ordersTransport "github.com/dofer/panel-api/internal/modules/orders/transport"
	"github.com/dofer/panel-api/internal/modules/tracking"
	"github.com/dofer/panel-api/internal/platform/config"
	"github.com/dofer/panel-api/internal/platform/httpserver/middleware"
	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
)

func New(cfg *config.Config, db *pgxpool.Pool) http.Handler {
	r := chi.NewRouter()

	// Middlewares globales
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.Timeout(60))

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
			"env":    cfg.Env,
		})
	})

	// Setup repositories
	userRepo := authInfra.NewPostgresUserRepository(db)
	orderRepo := ordersInfra.NewPostgresOrderRepository(db)

	// Setup auth handlers
	getUserHandler := app.NewGetUserByIDHandler(userRepo)
	authHandler := authTransport.NewAuthHandler(getUserHandler)

	// Setup order handlers
	createOrderHandler := ordersApp.NewCreateOrderHandler(orderRepo)
	getOrderHandler := ordersApp.NewGetOrderHandler(orderRepo)
	listOrdersHandler := ordersApp.NewListOrdersHandler(orderRepo)
	updateStatusHandler := ordersApp.NewUpdateOrderStatusHandler(orderRepo)
	assignOrderHandler := ordersApp.NewAssignOrderHandler(orderRepo)
	orderHandler := ordersTransport.NewOrderHandler(
		createOrderHandler,
		getOrderHandler,
		listOrdersHandler,
		updateStatusHandler,
		assignOrderHandler,
	)

	// Setup tracking handler
	trackingHandler := tracking.NewTrackingHandler(orderRepo)

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// Ping test
		r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"message": "pong"})
		})

		// Register module routes
		authTransport.RegisterRoutes(r, authHandler)
		ordersTransport.RegisterRoutes(r, orderHandler)
		tracking.RegisterRoutes(r, trackingHandler)
	})

	return r
}
