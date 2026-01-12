package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/dofer/panel-api/internal/platform/config"
	"github.com/dofer/panel-api/internal/platform/httpserver/router"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	httpServer *http.Server
	cfg        *config.Config
}

func New(cfg *config.Config, db *pgxpool.Pool) *Server {
	r := router.New(cfg, db)

	return &Server{
		httpServer: &http.Server{
			Addr:         fmt.Sprintf(":%s", cfg.Port),
			Handler:      r,
			ReadTimeout:  30 * time.Second,
			WriteTimeout: 30 * time.Second,
			IdleTimeout:  120 * time.Second,
		},
		cfg: cfg,
	}
}

func (s *Server) Start() error {
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
