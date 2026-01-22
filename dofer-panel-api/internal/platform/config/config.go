package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port                   string
	Env                    string
	DatabaseURL            string
	SupabaseURL            string
	SupabaseAnonKey        string
	SupabaseServiceRoleKey string
	JWTSecret              string
	CORSAllowedOrigins     []string
}

func Load() (*Config, error) {
	// Parse CORS origins from environment variable
	corsOrigins := []string{
		"http://localhost:3000",
		"http://localhost:3001",
		"http://localhost:3002",
		"http://localhost:5173",
	}
	
	if envOrigins := os.Getenv("CORS_ALLOWED_ORIGINS"); envOrigins != "" {
		corsOrigins = strings.Split(envOrigins, ",")
		// Trim whitespace from each origin
		for i := range corsOrigins {
			corsOrigins[i] = strings.TrimSpace(corsOrigins[i])
		}
	}
	
	cfg := &Config{
		Port:                   getEnv("API_PORT", "9000"),
		Env:                    getEnv("ENVIRONMENT", "development"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		SupabaseURL:            os.Getenv("SUPABASE_URL"),
		SupabaseAnonKey:        os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		JWTSecret:              os.Getenv("JWT_SECRET"),
		CORSAllowedOrigins:     corsOrigins,
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if c.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
