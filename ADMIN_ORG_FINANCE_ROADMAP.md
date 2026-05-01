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

## Pendiente Por Implementar

### Administracion De Usuarios

- Reenvio de invitaciones.
- Estado de invitacion pendiente/aceptada.
- Integracion visible con reset de contrasena de Supabase.

### Organizacion

- Soportar selector de organizacion si un usuario pertenece a mas de una.
- Mostrar auditoria basica de cambios administrativos.

### Finanzas Y Pagos

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
- Ampliar permisos frontend a botones y formularios de cada modulo.
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

## Segundo Corte De Trabajo

- [x] Agregar invitacion/alta de miembros por email.
- [x] Agregar baja de acceso de miembros desde UI.
- [x] Agregar endpoint y pantalla de organizacion.
- [x] Agregar endpoint y pantalla de finanzas/pagos.
- [x] Ocultar rutas administrativas del menu para roles no admin.
- [ ] Agregar filtros avanzados y exportacion CSV de finanzas.
- [ ] Agregar auditoria de cambios de roles y organizacion.
