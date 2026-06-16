# Checklist Beta Multiusuario DOFER Panel

Este archivo sirve para ir palomeando el avance hacia una beta estable y multiusuario.

Convencion:
- Tarea pendiente: `- [ ]`
- Tarea completada: `- [x]`
- Mantener notas cortas bajo cada seccion cuando aparezcan decisiones o bloqueos.

## 1. Auditoria Base

- [ ] Revisar flujo de pedidos: crear, listar, buscar, ver detalle, cambiar estado y eliminar si aplica.
- [ ] Revisar flujo de cotizaciones: crear, agregar items, editar, cambiar estado y convertir a pedido.
- [ ] Revisar registro de pagos en pedidos.
- [ ] Revisar registro de pagos en cotizaciones.
- [ ] Revisar estados de produccion y transiciones permitidas.
- [ ] Revisar clientes: crear, listar, buscar, editar y ver detalle.
- [ ] Revisar configuracion de costos.
- [x] Revisar impresoras y productos.
- [x] Documentar bugs encontrados con archivo, pantalla, endpoint y severidad.

Criterio de terminado:
- Existe una lista clara de errores reales, rutas faltantes y riesgos antes de tocar multiusuario.

## 2. Correccion de Errores Visibles

- [x] Crear o corregir endpoint `GET /printers`.
- [x] Crear o corregir endpoints necesarios para administrar impresoras.
- [x] Crear o corregir endpoints de productos si la UI los necesita.
- [x] Corregir llamadas frontend que apunten a endpoints inexistentes.
- [x] Corregir estados inconsistentes como `pending` vs `new` en pedidos.
- [ ] Evitar mensajes crudos de error tecnico visibles al usuario final.
- [ ] Agregar estados vacios claros cuando no haya datos.
- [ ] Verificar navegacion completa del dashboard sin pantallas rotas.

Criterio de terminado:
- Un beta tester puede recorrer el panel sin ver errores obvios de API, rutas inexistentes o pantallas quebradas.

## 3. Autenticacion Real

- [x] Quitar uso automatico de `test-token` en frontend.
- [x] Quitar usuario mock en middleware de API.
- [x] Validar token real de Supabase en la API.
- [x] Obtener `user_id`, email y rol desde la sesion real.
- [ ] Proteger rutas privadas del dashboard con sesion valida.
- [ ] Probar login, logout y sesion expirada.
- [x] Definir comportamiento para usuario sin organizacion asignada.

Criterio de terminado:
- Cada usuario entra con su cuenta real y la API rechaza requests sin token valido.

## 4. Modelo Multiusuario

- [x] Crear tabla `organizations` o `workspaces`.
- [x] Crear tabla `organization_members`.
- [x] Definir roles por organizacion: admin, operator, viewer.
- [x] Definir organizacion inicial para datos actuales, por ejemplo `DOFER`.
- [x] Agregar helper backend para obtener la organizacion activa desde el usuario autenticado.
- [x] Definir si un usuario puede pertenecer a varias organizaciones o solo a una en beta.

Criterio de terminado:
- El sistema tiene una estructura clara para que cada taller tenga su propio panel.

## 5. Aislamiento de Datos

- [x] Agregar `organization_id` a `orders`.
- [x] Agregar `organization_id` a `quotes`.
- [x] Agregar `organization_id` a `customers`.
- [x] Agregar `organization_id` a `products`.
- [x] Agregar `organization_id` a `printers`.
- [x] Agregar `organization_id` a `cost_settings`.
- [x] Agregar `organization_id` a pagos de pedidos.
- [x] Agregar `organization_id` a pagos de cotizaciones.
- [x] Revisar si timers, historial e items heredan aislamiento desde pedido/cotizacion o necesitan columna propia.
- [x] Crear indices por `organization_id` en tablas con listados frecuentes.

Criterio de terminado:
- Toda la informacion sensible o de operacion queda asociada a una organizacion.

## 6. Migracion Segura de Datos Actuales

- [x] Crear migracion para organizacion inicial `DOFER`.
- [x] Asignar datos existentes a la organizacion inicial.
- [x] Preservar IDs actuales de pedidos, cotizaciones, clientes y pagos.
- [ ] Verificar que no se pierdan datos actuales.
- [ ] Preparar rollback o respaldo antes de correr migracion en produccion.

Criterio de terminado:
- Los datos actuales siguen funcionando y ahora pertenecen a una organizacion.

## 7. Endpoints Protegidos por Organizacion

- [x] Filtrar `GET /orders` por organizacion.
- [x] Validar organizacion en `GET /orders/{id}`.
- [x] Validar organizacion al crear pedidos.
- [x] Validar organizacion al editar estado de pedido.
- [x] Validar organizacion al asignar pedido.
- [x] Validar organizacion en items de pedido.
- [x] Validar organizacion en pagos de pedido.
- [x] Filtrar estadisticas de pedidos por organizacion.
- [x] Filtrar busqueda de pedidos por organizacion.
- [x] Filtrar `GET /quotes` por organizacion.
- [x] Validar organizacion en detalle, edicion, items y pagos de cotizaciones.
- [x] Validar organizacion al convertir cotizacion a pedido.
- [x] Filtrar clientes por organizacion.
- [x] Filtrar costos por organizacion.
- [x] Filtrar productos por organizacion.
- [x] Filtrar impresoras por organizacion.

Criterio de terminado:
- Ningun endpoint privado devuelve, modifica o elimina datos de otra organizacion.

## 8. Roles y Permisos

- [ ] Admin puede configurar costos, usuarios, impresoras y productos.
- [ ] Admin puede crear, editar y eliminar datos operativos.
- [ ] Operator puede actualizar produccion, pedidos asignados y estados.
- [ ] Operator puede registrar avances permitidos.
- [ ] Viewer solo puede consultar informacion.
- [ ] Bloquear acciones no permitidas desde API, no solo desde UI.
- [ ] Ocultar o deshabilitar acciones no permitidas en frontend.

Criterio de terminado:
- Los permisos se aplican en backend y frontend de forma consistente.

## 9. Flujos Criticos de Beta

- [ ] Crear pedido desde cero.
- [ ] Crear cotizacion desde cero.
- [ ] Agregar items a cotizacion.
- [ ] Convertir cotizacion aceptada a pedido.
- [ ] Actualizar estado de produccion.
- [ ] Registrar pago parcial.
- [ ] Registrar pago completo.
- [ ] Ver balance pendiente.
- [ ] Crear cliente.
- [ ] Consultar dashboard principal.
- [ ] Configurar costos.
- [ ] Registrar impresora.
- [ ] Ver seguimiento publico de pedido si aplica.

Criterio de terminado:
- Los flujos principales se pueden completar sin intervencion tecnica.

## 10. Pruebas de Seguridad y Regresion

- [ ] Usuario A no puede listar pedidos de usuario B.
- [ ] Usuario A no puede abrir detalle de pedido de usuario B aunque conozca el ID.
- [ ] Usuario A no puede editar pedido de usuario B.
- [ ] Usuario A no puede borrar pago de usuario B.
- [ ] Usuario A no puede ver clientes de usuario B.
- [ ] Usuario A no puede ver cotizaciones de usuario B.
- [ ] Usuario sin token recibe `401`.
- [ ] Usuario sin permiso recibe `403`.
- [ ] Tests de pedidos pasan.
- [ ] Tests de cotizaciones pasan.
- [ ] Tests de pagos pasan.
- [ ] Tests de clientes pasan.
- [ ] Tests de impresoras/productos pasan.

Criterio de terminado:
- Hay pruebas automatizadas o una matriz manual documentada que confirma aislamiento y flujos principales.

## 11. Documentacion Beta

- [ ] Crear guia de uso para beta testers.
- [ ] Documentar como crear un pedido.
- [ ] Documentar como crear una cotizacion.
- [ ] Documentar como convertir cotizacion a pedido.
- [ ] Documentar como actualizar estados de produccion.
- [ ] Documentar como registrar pagos.
- [ ] Documentar como configurar costos.
- [ ] Documentar como reportar bugs.
- [ ] Agregar FAQ corta de soporte.
- [ ] Publicar guia como PDF, pagina interna o articulo en landing.

Criterio de terminado:
- Un tester puede usar el producto sin recibir instrucciones por WhatsApp en cada paso.

## 12. Metricas y Operacion Beta

- [ ] Definir numero objetivo de beta testers.
- [ ] Definir periodo de beta.
- [ ] Medir bugs por semana.
- [ ] Medir usuarios activos diarios.
- [ ] Medir modulos mas usados.
- [ ] Medir tiempo promedio de resolucion de bugs.
- [ ] Medir NPS o satisfaccion simple.
- [ ] Crear formulario de feedback.
- [ ] Crear canal privado de soporte o comunidad.
- [ ] Definir SLA interno de respuesta: ideal 24 a 48 horas.
- [ ] Comunicar mejoras aplicadas semanalmente.

Criterio de terminado:
- La beta tiene objetivos claros y feedback centralizado.

## 13. Preparacion de Planes Basic, Pro y Farm

- [ ] Definir limites del plan Basic.
- [ ] Definir limites del plan Pro.
- [ ] Definir limites del plan Farm.
- [ ] Definir precio beta o precio fundador.
- [ ] Definir beneficios de usuarios fundadores.
- [ ] Definir que funciones quedan fuera de beta.
- [ ] Medir conversion de testers a suscriptores.
- [ ] Ajustar producto antes de lanzamiento publico.

Criterio de terminado:
- Hay una propuesta comercial clara despues de validar la beta.

## Notas de Avance

- Fecha de inicio:
- Responsable principal:
- Organizacion inicial: DOFER (`00000000-0000-0000-0000-000000000001`)
- Primer grupo de testers:
- Riesgos abiertos: falta correr migracion 018 contra una DB real y respaldada; falta crear pruebas automatizadas de aislamiento Usuario A vs Usuario B; `npm install` reporta vulnerabilidades pendientes de auditoria.

## Notas Tecnicas

- 2026-04-27: Se bajaron cambios de `origin/main`; ya incluian modulos de impresoras/productos, pantalla de productos, mejoras de auth y plantillas de cotizacion.
- 2026-04-27: Verificacion inicial: `go test ./...`, `npm run lint` y `npm run build` pasan despues de sincronizar dependencias con `npm install`.
- 2026-04-27: Se agrego migracion `018_add_organizations_and_tenant_columns.sql` con `organizations`, `organization_members`, organizacion inicial `DOFER` y columnas `organization_id`.
- 2026-04-27: Se agrego resolucion de organizacion activa en backend. Para beta, un usuario autenticado sin organizacion recibe un workspace personal automaticamente.
- 2026-04-27: El frontend ya no manda un token de prueba automatico si no hay sesion/token explicito.
- 2026-04-27: Se conecto el filtro por organizacion en pedidos, cotizaciones, clientes, costos, productos e impresoras.
- 2026-04-27: Se blindo la migracion 018 para que no falle si las tablas opcionales `order_history` u `order_time_entries` todavia no existen.
- 2026-04-27: Verificacion posterior a cambios multiusuario: `go test ./...`, `npm run lint` y `npm run build` pasan.
- 2026-04-27: Se cerro aislamiento por organizacion en timers, historial, items, pagos, plantillas de cotizacion y analytics de clientes.
- 2026-04-27: El pago de cotizacion ahora tambien crea registro en `quote_payments`, no solo actualiza el balance.
- 2026-04-27: La migracion 018 ahora crea `order_history` y `order_time_entries`, tablas que el backend ya usaba para historial y timers.
- 2026-04-27: Verificacion final del bloque: `go test ./...`, `npm run lint`, `npm run build` y `git diff --check` pasan. Nota: la suite Go actual compila paquetes, pero casi todos los paquetes no tienen tests automatizados reales todavia.
