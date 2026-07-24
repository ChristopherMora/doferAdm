# Ventas del bazar

MVP disponible en:

- Panel: `/dashboard/bazar`
- Ruta compatible: `/admin/bazar`
- API: `/api/v1/bazar`

## Google Sheets

La cuenta de servicio debe tener permiso de edición sobre el documento.

Variables del backend:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_INVENTORY_SHEET_NAME=Inventario
GOOGLE_SALES_SHEET_NAME=Ventas
BAZAR_TIMEZONE=America/Mexico_City
```

Encabezados de la hoja `Inventario`:

| ID | Producto | Categoría | Precio | Costo | Stock | Imagen | Activo | Fecha de actualización |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Los encabezados también aceptan equivalentes como `SKU`, `Nombre`, `Existencia`,
`Image URL` y `Active`.

Encabezados de la hoja `Ventas`:

| ID Venta | Fecha | Hora | ID Producto | Producto | Cantidad | Precio Unitario | Total | Vendedor | Bazar | Método de Pago | Estado | Observaciones | Fecha de Registro |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Puesta en marcha

1. Aplicar las migraciones del módulo `030` a `033`.
2. Configurar las variables anteriores en la API.
3. Compartir el Google Sheet con `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
4. Reiniciar la API.
5. Abrir `/dashboard/bazar`, crear el bazar activo y pulsar sincronizar.

Cada venta se confirma primero en PostgreSQL y se sincroniza en segundo plano.
Si Google Sheets no responde, la venta queda visible como pendiente o con error y
puede reintentarse sin duplicar el registro.

## Operación sin Google Sheets

El catálogo también acepta productos manuales desde `/dashboard/bazar`.

- `POST /api/v1/bazar/products` crea un producto con nombre, precio y stock.
- El SKU es opcional; si se omite, la API genera uno con prefijo `MAN-`.
- Las ventas y cancelaciones descuentan o restauran el inventario en PostgreSQL.
- Sin Google Sheets configurado, las ventas permanecen pendientes y no bloquean la operación.
- Al preparar el inventario en Sheets, usar el mismo SKU permite relacionar el producto.

## Punto de venta y operación sin conexión

- `F2` abre una venta; `Alt+1`, `Alt+2` y `Alt+3` cambian entre efectivo,
  transferencia y tarjeta; `Ctrl+Enter` cobra.
- Los productos y ventas creados sin red se guardan en el dispositivo. Al
  regresar la conexión, se sincronizan primero los productos y después sus ventas.
- Los identificadores generados por el navegador son idempotentes, por lo que un
  reintento no duplica productos ni ventas.
- La pantalla visitada y sus recursos estáticos se conservan mediante
  `bazar-sw.js`; las respuestas de la API no se almacenan en caché.
- Favoritos, combos, ventas pendientes y último método de pago se conservan en
  el mismo dispositivo.

## Cortes

- `POST /api/v1/bazar/bazaars/{id}/daily-cuts` registra un corte del día sin
  cerrar el evento.
- `GET /api/v1/bazar/bazaars/{id}/daily-cuts` devuelve el historial de cortes.
- `POST /api/v1/bazar/bazaars/{id}/close` finaliza el bazar y bloquea nuevas
  ventas. Cuando hay cortes diarios, el cierre final consolida sus importes.
