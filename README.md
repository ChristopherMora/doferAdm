# DOFER Panel - Sistema de Gestión Operativa

Panel administrativo completo para gestionar pedidos, producción y cumplimiento en DOFER.

## 🎯 Visión

Construir el "cerebro operativo" de DOFER: un sistema que convierta el taller en una máquina repetible, donde los pedidos fluyen, el equipo ejecuta sin fricción y el cliente ve el estado sin perseguirte.

## 🏗️ Arquitectura

```
doferAdm/
├── dofer-panel-api/          # Backend API (Go)
│   ├── cmd/api/              # Entry point
│   ├── internal/
│   │   ├── platform/         # Infra transversal
│   │   ├── modules/          # Módulos de dominio
│   │   └── db/migrations/    # SQL migrations
│   └── docker/
│
├── dofer-panel-web/          # Frontend (Next.js)
│   ├── app/                  # App Router
│   ├── components/           # Componentes React
│   ├── lib/                  # Utils y config
│   └── types/                # TypeScript types
│
├── PROJECT_STATUS.md         # Estado del proyecto
└── SETUP_INSTRUCTIONS.md     # Guía de configuración
```

## 🚀 Quick Start

### Requisitos
- Go 1.22+
- Node.js 18+
- Docker & Docker Compose
- Cuenta de Supabase

### Instalación

1. **Configurar Supabase:**
   - Lee [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) para configurar tu proyecto

2. **Backend:**
   ```bash
   cd dofer-panel-api
   cp .env.example .env
   # Edita .env con tus credenciales
   make deps
   make run
   ```

3. **Frontend:**
   ```bash
   cd dofer-panel-web
   cp .env.local.example .env.local
   # Edita .env.local con tus credenciales
   npm install
   npm run dev
   ```

4. **Verificar:**
   - Backend: http://localhost:8080/health
   - Frontend: http://localhost:3000

## 📦 Stack Tecnológico

### Backend
- **Go 1.22** - Lenguaje principal
- **Chi Router** - HTTP routing
- **pgx** - PostgreSQL driver
- **Supabase** - Auth + Database
- **Docker** - Containerización

### Frontend
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase Client** - Auth

## 🎨 Módulos

### Core
- **Auth** - Autenticación y autorización (admin, operator, viewer)
- **Orders** - Gestión de pedidos (TikTok, local, marketplace)
- **Products** - Catálogo de productos con STL files
- **Tracking** - Vista pública para clientes

### Producción
- **Production Queue** - Cola de impresión optimizada
- **Inventory** - Control de materiales
- **Fulfillment** - Empaque y envío

### Integraciones
- **TikTok Shop** - Importación automática de pedidos
- **n8n** - Automatizaciones y notificaciones
- **Shopify** (próximamente)

## 📊 Estado del Proyecto

Consulta [PROJECT_STATUS.md](PROJECT_STATUS.md) para ver:
- ✅ Tareas completadas
- 🔄 En progreso
- ⏳ Pendientes
- 📝 Decisiones arquitectónicas

**Fase actual:** MVP - Semana 1 (Día 1-2 completado)

## 📝 Documentación

- [Instrucciones de Setup](SETUP_INSTRUCTIONS.md) - Configuración paso a paso
- [Backend README](dofer-panel-api/README.md) - API documentation
- [Frontend README](dofer-panel-web/README.md) - Frontend guide
- [Estado del Proyecto](PROJECT_STATUS.md) - Tracking detallado

## 🤝 Contribuir

Este es un proyecto privado de DOFER. Para contribuir:

1. Revisa [PROJECT_STATUS.md](PROJECT_STATUS.md) para ver tareas pendientes
2. Crea una rama feature: `git checkout -b feature/nombre`
3. Haz commits descriptivos
4. Push y crea un PR

## 📄 Licencia

Privado - DOFER © 2026

---

**Desarrollado con ❤️ para optimizar operaciones en DOFER**
