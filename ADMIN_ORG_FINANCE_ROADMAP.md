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
- Invitacion/alta de miembros por correo desde `Configuracion > Usuarios`.
- Baja de acceso de miembros sin borrar datos historicos.
- Pantalla `Configuracion > Organizacion` con nombre, slug y metricas base.
- Seccion `Finanzas` con resumen de cobrado, pendiente, vencido y pagos recientes.
- Permisos visuales basicos para ocultar finanzas y administracion a roles no admin.
- Selector de organizacion activo cuando un usuario admin tenga acceso a mas de una organizacion.
- Auditoria administrativa para cambios de organizacion, miembros, roles y pagos.
- Metricas por usuario: ordenes asignadas, entregadas, activas y tiempo registrado.
- Vista de cobranza `Por cobrar` con saldos pendientes, parciales y vencidos.
- Alertas de pagos vencidos en la seccion de finanzas.
- Cortes de cobranza diarios, semanales y mensuales.

## Pendiente Por Implementar

### Administracion De Usuarios

- Reenvio de invitaciones.
- Estado de invitacion pendiente/aceptada.
- Integracion visible con reset de contrasena de Supabase.
- Busqueda y filtros por rol, email y estado.
- Historial visible por usuario con cambios de rol y accesos.

### Organizacion

- Crear nuevas organizaciones desde UI.
- Archivar/desactivar organizaciones sin borrar historico.
- Permitir cambiar usuarios entre organizaciones.
- Reporte por organizacion si hay mas de una empresa o sucursal.
- Auditoria con filtros por tipo de cambio, usuario y fecha.

### Finanzas Y Pagos

- Filtros por rango de fechas, metodo, cliente, estado y plataforma.
- Registrar pagos desde una vista financiera central.
- Exportar pagos a CSV.
- Estados claros de pago: pendiente, parcial, pagado, vencido.
- Recordatorios o seguimiento de cobranza por cliente.
- Notas de cobranza por documento.
- Conciliacion manual de pagos.
- Desglose de cobranza por cliente, plataforma, metodo y usuario que registro el pago.
- Descargar cortes diarios/semanales/mensuales en CSV o PDF.
- Flujo de cancelacion o correccion de pagos con motivo obligatorio.

### Permisos

- Definir matriz de permisos:
  - `admin`: configuracion, usuarios, pagos, catalogos y operacion completa.
  - `operator`: ordenes, kanban, impresoras y tareas operativas.
  - `viewer`: lectura de informacion y estadisticas.
- Aplicar permisos en backend por endpoint.
- Ampliar permisos frontend a botones y formularios de cada modulo.
- Agregar pruebas de acceso por rol.
- Bloquear acciones sensibles por backend aunque el boton no aparezca en frontend.
- Definir permisos especificos para cobranza: ver, registrar, cancelar y exportar pagos.

### Calidad Y Deploy

- Mantener migraciones idempotentes.
- Asegurar que `019_repair_multiuser_auth_mapping.sql` se despliegue en produccion.
- Asegurar que `020_ensure_admin_finance_columns.sql` y `021_add_admin_audit_logs.sql` se desplieguen en produccion.
- Agregar health checks de API con validacion de migraciones criticas.
- Documentar pasos de recuperacion para `organization not available`.
- Agregar pruebas automatizadas para auditoria, selector de organizacion y cobranza.

## Primer Corte De Trabajo

- [x] Agregar endpoint para listar miembros de la organizacion actual.
- [x] Agregar endpoint para cambiar rol de un miembro.
- [x] Agregar pantalla `Configuracion > Usuarios`.
- [x] Conectar la navegacion lateral a la nueva pantalla.
- [x] Validar con `go test ./...`, `npm run lint` y `npm run build`.

## Segundo Corte De Trabajo

- [x] Agregar invitacion/alta de miembros por email.
- [x] Agregar baja de acceso de miembros desde UI.
- [x] Agregar endpoint y pantalla de organizacion.
- [x] Agregar endpoint y pantalla de finanzas/pagos.
- [x] Ocultar rutas administrativas del menu para roles no admin.

## Tercer Corte De Trabajo

- [x] Agregar selector de organizacion activo en layout y pantalla de organizacion.
- [x] Agregar endpoint de organizaciones disponibles para el usuario admin.
- [x] Agregar auditoria de cambios de roles, miembros, organizacion y pagos.
- [x] Agregar pantalla de auditoria en `Configuracion > Organizacion`.
- [x] Agregar metricas por usuario en `Configuracion > Organizacion`.
- [x] Agregar endpoint y vista de saldos por cobrar.
- [x] Agregar alertas de cobranza vencida.
- [x] Agregar cortes diarios, semanales y mensuales.
- [ ] Agregar filtros avanzados y exportacion CSV de finanzas.
- [ ] Agregar captura de pagos desde la vista financiera central.
