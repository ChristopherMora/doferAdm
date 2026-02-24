package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/dofer/panel-api/internal/db"
	ordersApp "github.com/dofer/panel-api/internal/modules/orders/app"
	ordersInfra "github.com/dofer/panel-api/internal/modules/orders/infra"
	"github.com/dofer/panel-api/internal/platform/config"
	"github.com/dofer/panel-api/internal/platform/email"
	"github.com/dofer/panel-api/internal/platform/httpserver"
	"github.com/dofer/panel-api/internal/platform/logger"
	"github.com/joho/godotenv"
)

func main() {
	// Cargar variables de entorno
	_ = godotenv.Load()

	// Configurar logger estructurado
	log := logger.New(os.Getenv("ENV"))
	slog.SetDefault(log)

	// Cargar configuración
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", slog.Any("error", err))
		os.Exit(1)
	}

	// Conectar a base de datos
	dbPool, err := db.NewPool(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", slog.Any("error", err))
		os.Exit(1)
	}
	defer dbPool.Close()
	slog.Info("database connection established")

	// Crear servidor HTTP
	server := httpserver.New(cfg, dbPool)
	jobCancel := func() {}

	// Job opcional: recordatorios SLA automáticos
	if parseBoolEnv("SLA_REMINDER_JOB_ENABLED", false) {
		orderRepo := ordersInfra.NewPostgresOrderRepository(dbPool)
		historyRepo := ordersInfra.NewPostgresOrderHistoryRepository(dbPool)
		mailer := email.NewConsoleMailer()
		slaHandler := ordersApp.NewSendSLARemindersHandler(orderRepo, historyRepo, mailer)

		jobCtx, cancel := context.WithCancel(context.Background())
		jobCancel = cancel

		intervalMinutes := parseIntEnv("SLA_REMINDER_INTERVAL_MINUTES", 60)
		if intervalMinutes <= 0 {
			intervalMinutes = 60
		}
		horizonHours := parseIntEnv("SLA_REMINDER_HORIZON_HOURS", 24)
		if horizonHours <= 0 {
			horizonHours = 24
		}
		runOnStart := parseBoolEnv("SLA_REMINDER_RUN_ON_START", false)

		go runSLAReminderWorker(jobCtx, slaHandler, time.Duration(intervalMinutes)*time.Minute, horizonHours, runOnStart)
		slog.Info("SLA reminder job enabled",
			slog.Int("interval_minutes", intervalMinutes),
			slog.Int("horizon_hours", horizonHours),
			slog.Bool("run_on_start", runOnStart),
		)
	}

	// Iniciar servidor en goroutine
	go func() {
		slog.Info("starting server", slog.String("port", cfg.Port), slog.String("env", cfg.Env))
		if err := server.Start(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", slog.Any("error", err))
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server...")
	jobCancel()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", slog.Any("error", err))
		os.Exit(1)
	}

	slog.Info("server stopped gracefully")
}

func runSLAReminderWorker(
	ctx context.Context,
	handler *ordersApp.SendSLARemindersHandler,
	interval time.Duration,
	horizonHours int,
	runOnStart bool,
) {
	run := func() {
		runCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		defer cancel()

		result, err := handler.Handle(runCtx, ordersApp.SendSLARemindersCommand{
			HorizonHours: horizonHours,
			DryRun:       false,
			TriggeredBy:  "system:sla-worker",
		})
		if err != nil {
			slog.Error("sla reminder job failed", slog.Any("error", err))
			return
		}

		slog.Info("sla reminder job completed",
			slog.Int("scanned", result.Scanned),
			slog.Int("candidates", result.Candidates),
			slog.Int("risk", result.Risk),
			slog.Int("overdue", result.Overdue),
			slog.Int("notified", result.Notified),
			slog.Int("failed", result.Failed),
		)
	}

	if runOnStart {
		run()
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}

func parseBoolEnv(key string, fallback bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}

	switch strings.ToLower(raw) {
	case "1", "true", "t", "yes", "y", "on":
		return true
	case "0", "false", "f", "no", "n", "off":
		return false
	default:
		return fallback
	}
}

func parseIntEnv(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}
