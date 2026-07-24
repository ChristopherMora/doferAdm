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

1. Aplicar `030_add_bazar_sales_module.sql`.
2. Configurar las variables anteriores en la API.
3. Compartir el Google Sheet con `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
4. Reiniciar la API.
5. Abrir `/dashboard/bazar`, crear el bazar activo y pulsar sincronizar.

Cada venta se confirma primero en PostgreSQL y se sincroniza en segundo plano.
Si Google Sheets no responde, la venta queda visible como pendiente o con error y
puede reintentarse sin duplicar el registro.
