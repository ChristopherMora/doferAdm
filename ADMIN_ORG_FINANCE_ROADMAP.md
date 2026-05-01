# Roadmap Administracion, Organizacion y Finanzas

## Estado Actual

### Ya implementado

- Autenticacion con Supabase y sincronizacion de usuarios hacia la base local.
- Organizacion base `DOFER` con `organization_id` en las entidades principales.
- Membresias de organizacion en `organization_members`.
- Roles base: `admin`, `operator`, `viewer`.
- Filtro de datos por organizacion en ordenes, cotizaciones, clientes, productos, impresoras, costos y pagos.
- Pagos parciales en ordenes y cotizaciones a nivel de API y detalle.
- Estadisticas operativas basicas: ordenes totales, estado, plataforma y completado.
- Reparacion operativa de produccion aplicada para asociar usuarios existentes a `DOFER`.
- Pantalla de administracion de usuarios y roles dentro de la organizacion.
- Endpoints internos para listar miembros y cambiar roles sin tocar la base por terminal.
- Barra lateral mostrando el rol real devuelto por el API.

## Pendiente Por Implementar

### Administracion De Usuarios

- Ocultar o deshabilitar acciones no permitidas segun rol.
- Flujo de invitacion de usuarios con Supabase.
- Reenvio de invitaciones y baja de usuarios.

### Organizacion

- Crear pantalla `Configuracion > Organizacion`.
- Editar nombre y slug de la organizacion.
- Ver miembros, conteo de ordenes, cotizaciones, clientes y productos.
- Soportar selector de organizacion si un usuario pertenece a mas de una.
- Mostrar auditoria basica de cambios administrativos.

### Finanzas Y Pagos

- Crear seccion `Finanzas` o `Pagos`.
- Dashboard financiero con cobrado, pendiente, vencido y tasa de cobranza.
- Listado consolidado de pagos de ordenes y cotizaciones.
- Filtros por rango de fechas, metodo, cliente, estado y plataforma.
- Registrar pagos desde una vista financiera central.
- Exportar pagos a CSV.
- Cortes diarios/semanales/mensuales.
- Estados claros de pago: pendiente, parcial, pagado, vencido.
- Alertas de cobranza para ordenes/cotizaciones con saldo pendiente.

### Permisos

- Definir matriz de permisos:
  - `admin`: configuracion, usuarios, pagos, catalogos y operacion completa.
  - `operator`: ordenes, kanban, impresoras y tareas operativas.
  - `viewer`: lectura de informacion y estadisticas.
- Aplicar permisos en backend por endpoint.
- Aplicar permisos en frontend para menus, botones y formularios.
- Agregar pruebas de acceso por rol.

### Calidad Y Deploy

- Mantener migraciones idempotentes.
- Asegurar que `019_repair_multiuser_auth_mapping.sql` se despliegue en produccion.
- Agregar health checks de API con validacion de migraciones criticas.
- Documentar pasos de recuperacion para `organization not available`.

## Primer Corte De Trabajo

- [x] Agregar endpoint para listar miembros de la organizacion actual.
- [x] Agregar endpoint para cambiar rol de un miembro.
- [x] Agregar pantalla `Configuracion > Usuarios`.
- [x] Conectar la navegacion lateral a la nueva pantalla.
- [x] Validar con `go test ./...`, `npm run lint` y `npm run build`.
