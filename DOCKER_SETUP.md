# 🐳 DOCKER SETUP GUIDE - DOFER PANEL

**Fecha:** 15 de Enero, 2026  
**Estado:** ✅ Docker configurado y listo

---

## 📋 ARCHIVOS INCLUIDOS

### En la raíz (`/home/mora/doferAdm/`)
- `docker-compose.yml` - Orquestación de servicios (DB, API, Web)
- `.env.example` - Variables de entorno (copiar a `.env`)

### En el backend (`dofer-panel-api/`)
- `Dockerfile` - Compilación multi-stage de Go

### En el frontend (`dofer-panel-web/`)
- `Dockerfile` - Compilación multi-stage de Next.js

---

## 🚀 INSTALACIÓN RÁPIDA

### 1. Clonar el repositorio
```bash
git clone https://github.com/ChristopherMora/doferAdm.git
cd doferAdm
```

### 2. Crear archivo .env
```bash
cp .env.example .env
```

### 3. Editar .env con tus valores
```bash
nano .env
# O usa tu editor favorito
```

**Variables importantes a actualizar:**
```env
# Database
DB_PASSWORD=tu-contraseña-segura

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Frontend
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=tu-anon-key
```

### 4. Levantar los servicios
```bash
# En desarrollo (con logs en pantalla)
docker-compose up

# En background
docker-compose up -d
```

### 5. Verificar que todo funcione
```bash
# Ver logs
docker-compose logs -f

# Ver servicios
docker-compose ps

# Acceder a la aplicación
# Frontend: http://localhost:3000
# Backend: http://localhost:9000
# Database: localhost:5432
```

---

## 📊 ESTRUCTURA DE SERVICIOS

### PostgreSQL (db)
- **Imagen:** postgres:16-alpine
- **Puerto interno:** 5432
- **Puerto host:** 5432 (configurable en .env con DB_PORT)
- **Usuario:** dofer (configurable con DB_USER)
- **Contraseña:** cambiar en .env (DB_PASSWORD)
- **Base de datos:** dofer_panel (configurable con DB_NAME)
- **Volumen:** postgres_data (persiste datos)

### API Go (api)
- **Build:** desde Dockerfile en dofer-panel-api/
- **Puerto interno:** 9000
- **Puerto host:** 9000 (configurable en .env con API_PORT)
- **Healthcheck:** Cada 30s en `/api/v1/health`
- **Depende de:** Servicio db (espera que esté healthy)

### Frontend Next.js (web)
- **Build:** desde Dockerfile en dofer-panel-web/
- **Puerto interno:** 3000
- **Puerto host:** 3000 (configurable en .env con WEB_PORT)
- **Healthcheck:** Cada 30s en `http://localhost:3000`
- **Depende de:** Servicio api (espera que esté healthy)

---

## 🔧 COMANDOS ÚTILES

### Iniciar servicios
```bash
# Todo
docker-compose up -d

# Solo un servicio
docker-compose up -d db
docker-compose up -d api
docker-compose up -d web
```

### Ver logs
```bash
# Todos los servicios
docker-compose logs -f

# Un servicio específico
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f db
```

### Detener servicios
```bash
# Todos
docker-compose down

# Mantener volúmenes (datos de BD)
docker-compose down -v  # CUIDADO: borra datos!
```

### Acceder a contenedores
```bash
# API (Go)
docker-compose exec api sh

# Frontend (Node)
docker-compose exec web sh

# Database (PostgreSQL)
docker-compose exec db psql -U dofer -d dofer_panel
```

### Reconstruir imágenes
```bash
# Forzar rebuild
docker-compose build --no-cache

# Rebuild y reiniciar
docker-compose up -d --build
```

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### El servicio no inicia
```bash
# Ver logs detallados
docker-compose logs -f [servicio]

# Verificar estado
docker-compose ps
```

### Error: "db is not running"
```bash
# Verificar que la BD esté healthy
docker-compose exec db pg_isready -U dofer

# Revisar logs de la BD
docker-compose logs db
```

### Error: "Cannot connect to API"
```bash
# Verificar que API esté escuchando
docker-compose exec api curl -f http://localhost:9000/api/v1/health

# Revisar logs
docker-compose logs api
```

### Error: "Variables not defined"
```bash
# Copiar .env.example a .env
cp .env.example .env

# Verificar que .env existe en la raíz
ls -la .env
```

### Limpiar todo (cuidado!)
```bash
# Detener y eliminar todo
docker-compose down -v

# Eliminar volúmenes
docker volume rm doferAdm_postgres_data

# Limpiar imágenes
docker rmi dofer-panel-api dofer-panel-web
```

---

## 🔐 SEGURIDAD EN PRODUCCIÓN

### Cambiar contraseñas
```env
# .env
DB_PASSWORD=super-secure-password-32chars-minimum
JWT_SECRET=another-super-secure-key-32chars-minimum
```

### Actualizar puertos
```env
# Cambiar puertos por defecto
API_PORT=9001
WEB_PORT=3001
DB_PORT=5433
```

### Certificados SSL
Para HTTPS, usar Nginx/Traefik como proxy inverso:
```bash
# Ejemplo con Traefik (agregar a docker-compose.yml)
traefik:
  image: traefik:latest
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
```

### Variables de entorno secretas
```bash
# En CI/CD, no guardar en git
.env  # Agregar a .gitignore
```

---

## 📈 MONITOREO

### Ver uso de recursos
```bash
docker stats
```

### Ver logs en tiempo real
```bash
docker-compose logs -f --tail=100
```

### Health checks
```bash
# Verificar salud de servicios
docker-compose ps

# Ver detalles de healthcheck
docker inspect dofer-api | grep -A 5 "Health"
```

---

## 🚢 DEPLOYMENT A PRODUCCIÓN

### 1. Preparar servidor
```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo apt install docker-compose
```

### 2. Clonar y configurar
```bash
git clone [repo] /opt/dofer
cd /opt/dofer
cp .env.example .env
# Editar .env con valores reales
sudo nano .env
```

### 3. Levantar en background
```bash
docker-compose up -d
```

### 4. Verificar logs
```bash
docker-compose logs -f
```

### 5. Backups automáticos
```bash
# Ver volúmenes
docker volume ls

# Backup de datos
docker run --rm -v doferAdm_postgres_data:/data \
  -v /backup:/backup \
  ubuntu tar czf /backup/postgres-backup.tar.gz -C /data .
```

---

## 📞 SOPORTE

### Verificar compilación
```bash
# Revisar si las imágenes se construyeron
docker images | grep dofer

# Ver tamaño de imágenes
docker images --no-trunc | grep dofer
```

### Resetear todo
```bash
# Destruir y limpiar
docker-compose down -v
docker system prune -a --volumes

# Reconstruir todo
docker-compose up -d --build
```

---

## ✅ CHECKLIST DE DEPLOY

- [ ] Archivo `.env` creado y configurado
- [ ] Variables de Supabase actualizadas
- [ ] Contraseña de BD cambiada
- [ ] `docker-compose up -d` ejecutado
- [ ] Todos los servicios en estado "healthy"
- [ ] Frontend accesible en http://localhost:3000
- [ ] API accesible en http://localhost:9000/api/v1/health
- [ ] Base de datos conectando correctamente
- [ ] Logs sin errores

---

**Estado:** ✅ Docker completamente configurado  
**Versión:** 1.0  
**Última actualización:** 15 de Enero, 2026
