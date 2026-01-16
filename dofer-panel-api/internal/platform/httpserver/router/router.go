package router

import (
	"encoding/json"
	"net/http"

	"github.com/dofer/panel-api/internal/modules/auth/app"
	authInfra "github.com/dofer/panel-api/internal/modules/auth/infra"
	authTransport "github.com/dofer/panel-api/internal/modules/auth/transport"
	costsApp "github.com/dofer/panel-api/internal/modules/costs/app"
	costsInfra "github.com/dofer/panel-api/internal/modules/costs/infra"
	costsTransport "github.com/dofer/panel-api/internal/modules/costs/transport"
	ordersApp "github.com/dofer/panel-api/internal/modules/orders/app"
	ordersInfra "github.com/dofer/panel-api/internal/modules/orders/infra"
	ordersTransport "github.com/dofer/panel-api/internal/modules/orders/transport"
	quotesApp "github.com/dofer/panel-api/internal/modules/quotes/app"
	quotesInfra "github.com/dofer/panel-api/internal/modules/quotes/infra"
	quotesTransport "github.com/dofer/panel-api/internal/modules/quotes/transport"
	"github.com/dofer/panel-api/internal/modules/tracking"
	"github.com/dofer/panel-api/internal/platform/config"
	"github.com/dofer/panel-api/internal/platform/email"
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
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:5173", "http://31.220.55.210:3001", "http://31.220.55.210:3002", "http://31.220.55.210:9000", "http://31.220.55.210:9001", "https://31.220.55.210:3001", "https://31.220.55.210:3002", "https://31.220.55.210:9000", "https://31.220.55.210:9001"},
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
	historyRepo := ordersInfra.NewPostgresOrderHistoryRepository(db)
	timerRepo := ordersInfra.NewPostgresTimerRepository(db)

	// Setup email service (usando ConsoleMailer para desarrollo)
	mailer := email.NewConsoleMailer()

	// Setup auth handlers
	getUserHandler := app.NewGetUserByIDHandler(userRepo)
	authHandler := authTransport.NewAuthHandler(getUserHandler)

	// Setup order handlers
	createOrderHandler := ordersApp.NewCreateOrderHandler(orderRepo)
	getOrderHandler := ordersApp.NewGetOrderHandler(orderRepo)
	listOrdersHandler := ordersApp.NewListOrdersHandler(orderRepo)
	updateStatusHandler := ordersApp.NewUpdateOrderStatusHandler(orderRepo, historyRepo, mailer)
	assignOrderHandler := ordersApp.NewAssignOrderHandler(orderRepo, historyRepo)
	getHistoryHandler := ordersApp.NewGetOrderHistoryHandler(historyRepo)
	getStatsHandler := ordersApp.NewGetOrderStatsHandler(orderRepo)
	searchOrdersHandler := ordersApp.NewSearchOrdersHandler(orderRepo)

	// Setup timer handlers
	startTimerHandler := ordersApp.NewStartTimerHandler(orderRepo, timerRepo)
	pauseTimerHandler := ordersApp.NewPauseTimerHandler(orderRepo, timerRepo)
	stopTimerHandler := ordersApp.NewStopTimerHandler(orderRepo, timerRepo)
	getTimerHandler := ordersApp.NewGetTimerHandler(timerRepo)
	updateEstimatedHandler := ordersApp.NewUpdateEstimatedTimeHandler(timerRepo)
	operatorStatsHandler := ordersApp.NewGetOperatorStatsHandler(timerRepo)

	orderHandler := ordersTransport.NewOrderHandler(
		createOrderHandler,
		getOrderHandler,
		listOrdersHandler,
		updateStatusHandler,
		assignOrderHandler,
		getHistoryHandler,
		getStatsHandler,
		searchOrdersHandler,
		startTimerHandler,
		pauseTimerHandler,
		stopTimerHandler,
		getTimerHandler,
		updateEstimatedHandler,
		operatorStatsHandler,
	)

	// Setup cost handlers
	costRepo := costsInfra.NewPostgresCostSettingsRepository(db)
	getCostSettingsHandler := costsApp.NewGetCostSettingsHandler(costRepo)
	updateCostSettingsHandler := costsApp.NewUpdateCostSettingsHandler(costRepo)
	calculateCostHandler := costsApp.NewCalculateCostHandler(costRepo)
	costHandler := costsTransport.NewCostHandler(
		getCostSettingsHandler,
		updateCostSettingsHandler,
		calculateCostHandler,
	)

	// Setup quote handlers
	quoteRepo := quotesInfra.NewPostgresQuoteRepository(db)
	createQuoteHandler := quotesApp.NewCreateQuoteHandler(quoteRepo)
	getQuoteHandler := quotesApp.NewGetQuoteHandler(quoteRepo)
	listQuotesHandler := quotesApp.NewListQuotesHandler(quoteRepo)
	addQuoteItemHandler := quotesApp.NewAddQuoteItemHandler(quoteRepo, calculateCostHandler)
	updateQuoteStatusHandler := quotesApp.NewUpdateQuoteStatusHandler(quoteRepo)
	deleteQuoteItemHandler := quotesApp.NewDeleteQuoteItemHandler(quoteRepo)
	deleteQuoteHandler := quotesApp.NewDeleteQuoteHandler(quoteRepo)
	searchQuotesHandler := quotesApp.NewSearchQuotesHandler(quoteRepo)
	quoteHandler := quotesTransport.NewQuoteHandler(
		createQuoteHandler,
		getQuoteHandler,
		listQuotesHandler,
		addQuoteItemHandler,
		updateQuoteStatusHandler,
		deleteQuoteItemHandler,
		deleteQuoteHandler,
		searchQuotesHandler,
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
		costsTransport.RegisterRoutes(r, costHandler)
		quotesTransport.RegisterRoutes(r, quoteHandler)
		tracking.RegisterRoutes(r, trackingHandler)
	})

	return r
}
