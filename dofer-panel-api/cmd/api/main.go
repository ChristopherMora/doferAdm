package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dofer/panel-api/internal/db"
	"github.com/dofer/panel-api/internal/platform/config"
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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", slog.Any("error", err))
		os.Exit(1)
	}

	slog.Info("server stopped gracefully")
}
