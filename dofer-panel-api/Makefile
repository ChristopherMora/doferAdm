.PHONY: help run build test clean deps migrate-up migrate-down docker-up docker-down

help: ## Mostrar esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

deps: ## Instalar dependencias
	go mod download
	go mod tidy

run: ## Ejecutar la aplicación
	go run cmd/api/main.go

build: ## Compilar la aplicación
	go build -o bin/api cmd/api/main.go

test: ## Ejecutar tests
	go test -v -race -cover ./...

clean: ## Limpiar archivos generados
	rm -rf bin/
	go clean

docker-up: ## Levantar Docker Compose
	docker-compose up -d

docker-down: ## Detener Docker Compose
	docker-compose down

docker-logs: ## Ver logs de Docker
	docker-compose logs -f

migrate-up: ## Aplicar migraciones (manual con psql)
	@echo "Ejecuta en tu cliente de Supabase o psql:"
	@echo "psql \$$DATABASE_URL < internal/db/migrations/001_initial_schema.sql"

dev: ## Modo desarrollo con hot reload (requiere air)
	air
