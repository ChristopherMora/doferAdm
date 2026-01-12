# 🎉 Instalación Completada - DOFER Panel

Fecha: 10 de enero, 2026

## ✅ Lo que se ha instalado y configurado

### 1. Backend (Go)
- ✅ Dependencias de Go instaladas (Go 1.24.11)
- ✅ Archivo `.env` creado con JWT secret generado
- ✅ Proyecto compilable y listo para ejecutar

### 2. Frontend (Next.js)
- ✅ Node.js v20.19.6 instalado y activado (mediante NVM)
- ✅ Todas las dependencias npm instaladas (397 paquetes)
- ✅ Archivo `.env.local` creado
- ✅ **Frontend corriendo en http://localhost:3000** ✨

### 3. Scripts de utilidad creados
- ✅ `setup.sh` - Verifica y prepara el sistema
- ✅ `start.sh` - Inicia todo el sistema de una vez

## 🚀 Cómo usar el proyecto

### Frontend ya está corriendo 🎨
El frontend de Next.js está actualmente ejecutándose en:
- **http://localhost:3000**

Puedes abrirlo en tu navegador.

### Para el Backend necesitas configurar la base de datos

El backend requiere PostgreSQL. Tienes 3 opciones:

#### Opción 1: Docker Desktop (Más fácil) 🐳

1. Instala Docker Desktop desde: https://docs.docker.com/desktop/wsl/
2. Habilita la integración con WSL
3. Ejecuta:
   ```bash
   cd dofer-panel-api
   docker-compose up -d
   go run cmd/api/main.go
   ```

#### Opción 2: Supabase (Cloud, Gratuito) ☁️

1. Crea una cuenta en https://supabase.com
2. Crea un nuevo proyecto
3. En el SQL Editor, ejecuta las migraciones:
   - `dofer-panel-api/internal/db/migrations/001_initial_schema.sql`
   - `dofer-panel-api/internal/db/migrations/002_add_product_image.sql`
4. Copia las credenciales de Settings > API a:
   - `dofer-panel-api/.env`
   - `dofer-panel-web/.env.local`
5. Ejecuta el backend:
   ```bash
   cd dofer-panel-api
   go run cmd/api/main.go
   ```

#### Opción 3: PostgreSQL Local 🗄️

Si ya tienes PostgreSQL instalado localmente:

1. Crea la base de datos:
   ```bash
   createdb dofer_panel
   ```
2. Aplica las migraciones:
   ```bash
   psql dofer_panel < dofer-panel-api/internal/db/migrations/001_initial_schema.sql
   psql dofer_panel < dofer-panel-api/internal/db/migrations/002_add_product_image.sql
   ```
3. Actualiza `dofer-panel-api/.env` con tu connection string
4. Ejecuta el backend:
   ```bash
   cd dofer-panel-api
   go run cmd/api/main.go
   ```

## 📁 Archivos de configuración

### Backend: `dofer-panel-api/.env`
```env
PORT=8080
ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:54322/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=Tytp5NGGf15xovwGs5nh9KNBGog1ZiYUG0yda+/5gOE=
```

### Frontend: `dofer-panel-web/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 🔧 Comandos útiles

### Iniciar todo el sistema
```bash
./start.sh
```

### Solo Frontend
```bash
cd dofer-panel-web
npm run dev
```

### Solo Backend (requiere DB)
```bash
cd dofer-panel-api
go run cmd/api/main.go
```

### Verificar setup
```bash
./setup.sh
```

## ⚠️ Nota importante

Para usar NVM en nuevas terminales, asegúrate de que esté activado:
```bash
source ~/.nvm/nvm.sh
nvm use 20
```

O agrega esto a tu `~/.bashrc`:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

## 📚 Documentación adicional

- [README.md](README.md) - Información general del proyecto
- [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) - Guía detallada de configuración
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Estado del proyecto

## 🐛 Solución de problemas

### El frontend no inicia
Verifica que estás usando Node.js v20+:
```bash
node --version  # Debe ser v20.9.0 o superior
```

Si no, activa NVM:
```bash
source ~/.nvm/nvm.sh
nvm use 20
```

### El backend no conecta a la base de datos
- Verifica que Docker esté corriendo (si usas Docker)
- O que Supabase esté configurado correctamente
- Revisa el archivo `.env` en `dofer-panel-api/`

### Error al instalar dependencias
```bash
# Backend
cd dofer-panel-api
go mod tidy

# Frontend
cd dofer-panel-web
rm -rf node_modules package-lock.json
npm install
```

## 🎯 Próximos pasos

1. Elige una opción para la base de datos (Docker, Supabase o PostgreSQL local)
2. Configura las credenciales en los archivos `.env`
3. Ejecuta el backend
4. ¡Empieza a desarrollar! 🚀

---

**Estado actual:** ✅ Frontend corriendo | ⏳ Backend esperando configuración de DB
