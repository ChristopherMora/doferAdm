# 💼 Sistema de Cotizaciones DOFER

## 📋 Descripción General

El sistema de cotizaciones permite crear, gestionar y aprobar cotizaciones para clientes con cálculo automático de costos basado en el módulo de calculadora de costos.

## ✨ Características Principales

### 1. **Creación de Cotizaciones**
- Datos del cliente (nombre, email, teléfono)
- Notas personalizadas
- Validez configurable (días)
- Número de cotización auto-generado (formato: QT-YYYYMMDD-XXX)

### 2. **Gestión de Items**
- Agregar múltiples items a una cotización
- Cálculo automático de costos por item:
  - Costo de material (basado en peso)
  - Costo de energía eléctrica (basado en tiempo de impresión)
  - Costo de mano de obra (basado en tiempo)
  - Margen de ganancia configurable
  - Otros costos adicionales
- Especificaciones detalladas por item

### 3. **Estados de Cotización**
- **Pendiente** (pending): Cotización recién creada
- **Aprobada** (approved): Cliente aceptó la cotización
- **Rechazada** (rejected): Cliente rechazó la cotización
- **Expirada** (expired): Cotización venció su fecha de validez

### 4. **Funcionalidades**
- Lista de cotizaciones con filtros por estado
- Vista detallada con breakdown de costos
- Actualización de estados
- Envío por email
- Impresión de cotización
- Conversión a pedido (próximamente)

## 🎯 Flujo de Trabajo

```
1. Crear Cotización
   ↓
2. Ingresar datos del cliente
   ↓
3. Agregar items con especificaciones
   ↓ (automático)
4. Calculadora calcula costos
   ↓
5. Revisar totales (subtotal + IVA)
   ↓
6. Enviar al cliente
   ↓
7. Cliente aprueba/rechaza
   ↓
8. Convertir a pedido (si aprobada)
```

## 🛠️ Backend API

### Endpoints Disponibles

#### 1. Crear Cotización
```bash
POST /api/v1/quotes
Content-Type: application/json

{
  "customer_name": "Juan Pérez",
  "customer_email": "juan@example.com",
  "customer_phone": "5551234567",
  "notes": "Cliente frecuente",
  "valid_days": 15
}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "quote_number": "QT-20240115-001",
  "customer_name": "Juan Pérez",
  "customer_email": "juan@example.com",
  "status": "pending",
  "valid_until": "2024-01-30T00:00:00Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### 2. Agregar Item a Cotización
```bash
POST /api/v1/quotes/{id}/items
Content-Type: application/json

{
  "product_name": "Maceta decorativa",
  "description": "Diseño hexagonal",
  "weight_grams": 100,
  "print_time_hours": 5.0,
  "quantity": 2,
  "other_costs": 10.0
}
```

**Cálculo Automático:**
El backend calcula automáticamente:
- `material_cost`: weight_grams × cost_per_gram
- `electricity_cost`: print_time_hours × cost_per_hour
- `labor_cost`: print_time_hours × labor_cost_per_hour
- `base_cost`: material + electricity + labor + other_costs
- `unit_price`: base_cost × (1 + profit_margin) / quantity
- `subtotal`: unit_price × quantity
- `total`: subtotal × 1.16 (IVA incluido)

#### 3. Listar Cotizaciones
```bash
GET /api/v1/quotes
GET /api/v1/quotes?status=pending
```

**Respuesta:**
```json
{
  "quotes": [
    {
      "id": "uuid",
      "quote_number": "QT-20240115-001",
      "customer_name": "Juan Pérez",
      "customer_email": "juan@example.com",
      "status": "pending",
      "subtotal": 500.00,
      "tax": 80.00,
      "total": 580.00,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 4. Obtener Detalles de Cotización
```bash
GET /api/v1/quotes/{id}
```

**Respuesta incluye:**
- Datos del cliente
- Lista completa de items con breakdown de costos
- Totales calculados
- Fechas de creación y validez

#### 5. Actualizar Estado
```bash
PATCH /api/v1/quotes/{id}/status
Content-Type: application/json

{
  "status": "approved"
}
```

## 💻 Frontend

### Páginas Disponibles

#### 1. Lista de Cotizaciones
**Ruta:** `/dashboard/quotes`

**Características:**
- Tabla con todas las cotizaciones
- Filtros por estado (todas, pendientes, aprobadas, rechazadas, expiradas)
- Badges de estado con colores
- Búsqueda por cliente
- Botón "Nueva Cotización"

#### 2. Crear Nueva Cotización
**Ruta:** `/dashboard/quotes/new`

**Flujo en 2 pasos:**

**Paso 1: Datos del Cliente**
- Nombre (requerido)
- Email (requerido)
- Teléfono (opcional)
- Validez en días (default: 15)
- Notas (opcional)

**Paso 2: Agregar Items**
- Formulario por item:
  - Nombre del producto
  - Descripción
  - Peso en gramos
  - Tiempo de impresión en horas
  - Cantidad
  - Otros costos
- Calculadora integrada muestra costo en tiempo real
- Botón "Agregar Item"
- Lista de items agregados con totales
- Botón "Finalizar Cotización"

#### 3. Detalle de Cotización
**Ruta:** `/dashboard/quotes/[id]`

**Secciones:**
- **Header:** Número, estado, fecha
- **Cliente:** Nombre, email, teléfono, notas
- **Items:** Tabla con especificaciones y costos
- **Totales:** Subtotal, IVA, Total
- **Acciones:**
  - Aprobar/Rechazar (si está pendiente)
  - Imprimir
  - Enviar por email
  - Convertir a pedido (si aprobada)

### Componentes Reutilizables

#### CalculadoraCostos
Se integra en el formulario de items para mostrar el cálculo en tiempo real:
```tsx
<CalculadoraCostos 
  onCalculated={(breakdown) => {
    // breakdown contiene todos los costos calculados
    addItemToQuote(breakdown)
  }}
/>
```

## 📊 Base de Datos

### Tabla: quotes
```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  valid_until TIMESTAMP,
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotes_customer_email ON quotes(customer_email);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
```

### Tabla: quote_items
```sql
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  description TEXT,
  weight_grams DECIMAL(10,2) NOT NULL,
  print_time_hours DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  material_cost DECIMAL(10,2) DEFAULT 0,
  electricity_cost DECIMAL(10,2) DEFAULT 0,
  labor_cost DECIMAL(10,2) DEFAULT 0,
  other_costs DECIMAL(10,2) DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
```

## 🧮 Integración con Calculadora de Costos

La cotización utiliza automáticamente la configuración de la calculadora de costos:

1. **Configuración Base** (tabla `cost_settings`):
   - Costo por gramo de material
   - Costo por hora de electricidad
   - Costo por hora de mano de obra
   - Margen de ganancia (%)

2. **Cálculo por Item:**
   ```
   material_cost = peso_gramos × costo_por_gramo
   electricity_cost = tiempo_horas × costo_electricidad
   labor_cost = tiempo_horas × costo_mano_obra
   base_cost = material + electricity + labor + otros_costos
   
   unit_price = (base_cost × (1 + margen_ganancia)) / cantidad
   subtotal = unit_price × cantidad
   total = subtotal × 1.16  // IVA 16%
   ```

3. **Actualización de Totales:**
   Cada vez que se agrega un item, se recalculan los totales de la cotización:
   ```
   quote.subtotal = SUM(items.subtotal)
   quote.tax = quote.subtotal × 0.16
   quote.total = quote.subtotal + quote.tax
   ```

## 🎨 UI/UX

### Colores de Estado
- **Pendiente:** Amarillo (`bg-yellow-100 text-yellow-800`)
- **Aprobada:** Verde (`bg-green-100 text-green-800`)
- **Rechazada:** Rojo (`bg-red-100 text-red-800`)
- **Expirada:** Gris (`bg-gray-100 text-gray-800`)

### Iconos
- 💼 Cotizaciones (sidebar)
- 📝 Nueva cotización
- 📦 Items
- ✅ Aprobar
- ❌ Rechazar
- 🖨️ Imprimir
- 📧 Enviar email

## 🧪 Testing

### Prueba Manual
1. Inicia el backend: `make run` en `dofer-panel-api/`
2. Inicia el frontend: `npm run dev` en `dofer-panel-web/`
3. Navega a `http://localhost:3000/dashboard/quotes`
4. Crea una nueva cotización con el botón "Nueva Cotización"
5. Completa datos del cliente
6. Agrega items usando la calculadora
7. Finaliza y revisa el detalle
8. Prueba aprobar/rechazar

### Script Automatizado
```bash
# Ejecutar pruebas del API
./test_cotizaciones.sh
```

El script prueba:
- Creación de cotización
- Agregar múltiples items
- Listado de cotizaciones
- Actualización de estado
- Verificación de totales

## 📈 Próximas Mejoras

1. **Conversión a Pedido:**
   - Botón para convertir cotización aprobada en pedido
   - Copiar items con sus costos calculados
   - Crear pedido con estado "pending"

2. **Export PDF:**
   - Generar PDF profesional de la cotización
   - Incluir logo de la empresa
   - Términos y condiciones

3. **Notificaciones:**
   - Email automático al crear cotización
   - Recordatorios antes de expiración
   - Notificación de aprobación/rechazo

4. **Historial:**
   - Seguimiento de cambios de estado
   - Auditoría de modificaciones
   - Comparación de versiones

5. **Descuentos:**
   - Aplicar descuentos por item
   - Descuentos globales
   - Códigos promocionales

6. **Templates:**
   - Plantillas de cotización predefinidas
   - Items frecuentes guardados
   - Presets de configuración

## 🔗 Integración con Otros Módulos

### Con Calculadora de Costos
- Usa la misma configuración de costos
- Comparte la lógica de cálculo
- Actualización en tiempo real

### Con Órdenes (próximo)
- Convertir cotización → pedido
- Heredar datos del cliente
- Copiar items y precios

### Con Tracking (futuro)
- URL pública para seguimiento de cotización
- Estado público visible para cliente
- Aceptación/Rechazo desde tracking

## 📝 Notas Técnicas

### Arquitectura Backend
- **Domain:** Entidades Quote y QuoteItem
- **Repository:** CRUD completo + generación de números
- **App:** 5 handlers (create, get, list, add_item, update_status)
- **Transport:** Rutas HTTP con autenticación requerida

### Arquitectura Frontend
- **Pages:** Lista, Nueva, Detalle
- **Components:** CalculadoraCostos (reutilizable)
- **Types:** Interfaces Quote y QuoteItem
- **API Client:** Métodos GET/POST/PATCH para quotes

### Seguridad
- Todos los endpoints requieren autenticación (middleware.RequireAuth)
- Validación de datos en backend
- Sanitización de inputs en frontend
- CORS configurado correctamente

## 🚀 Deploy

### Producción
1. Configurar variables de entorno
2. Migrar base de datos (ejecutar SQLs)
3. Compilar backend: `make build`
4. Compilar frontend: `npm run build`
5. Configurar reverse proxy (nginx/caddy)
6. SSL/TLS con Let's Encrypt

### Docker
```bash
# Backend
cd dofer-panel-api
docker build -t dofer-api .
docker run -p 9000:9000 dofer-api

# Frontend
cd dofer-panel-web
docker build -t dofer-web .
docker run -p 3000:3000 dofer-web
```

---

**Desarrollado para DOFER Panel MVP** 🚀
