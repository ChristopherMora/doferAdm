import {
  escapeHTML,
  moneyFormatter,
  paymentLabel,
} from './format'
import type {
  BazarReport,
  Sale,
} from './types'

function csvCell(value: string | number) {
  const text = String(value).replaceAll('"', '""')
  return `"${text}"`
}

export function downloadDailyReportCSV(report: BazarReport) {
  const rows: Array<Array<string | number>> = [
    ['Reporte de bazar', report.bazar?.name || 'Todos los bazares'],
    ['Fecha', report.date],
    ['Total', report.total],
    ['Operaciones', report.operations],
    ['Productos vendidos', report.products_sold],
    [],
    ['Productos'],
    ['SKU', 'Producto', 'Cantidad', 'Total'],
    ...report.products.map((item) => [
      item.external_id,
      item.product_name,
      item.quantity,
      item.total,
    ]),
    [],
    ['Métodos de pago'],
    ['Método', 'Operaciones', 'Total'],
    ...report.payment_methods.map((item) => [
      paymentLabel(item.method),
      item.operations,
      item.total,
    ]),
    [],
    ['Vendedores'],
    ['Vendedor', 'Operaciones', 'Unidades', 'Total'],
    ...report.sellers.map((item) => [
      item.seller_name,
      item.operations,
      item.quantity,
      item.total,
    ]),
]

  const content = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `bazar-${report.date}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function downloadDailyReportPDF(report: BazarReport) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const document = new jsPDF()
  document.setFontSize(18)
  document.text('Reporte diario de bazar', 14, 18)
  document.setFontSize(10)
  document.text(`${report.bazar?.name || 'Todos los bazares'} · ${report.date}`, 14, 25)
  document.text(`Total: ${moneyFormatter.format(report.total)}`, 14, 33)
  document.text(`Operaciones: ${report.operations} · Unidades: ${report.products_sold}`, 14, 39)
  autoTable(document, {
    startY: 46,
    head: [['SKU', 'Producto', 'Cantidad', 'Total']],
    body: report.products.map((item) => [
      item.external_id,
      item.product_name,
      String(item.quantity),
      moneyFormatter.format(item.total),
    ]),
    styles: { fontSize: 8 },
  })
  const finalY =
    (document as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY || 60
  autoTable(document, {
    startY: finalY + 8,
    head: [['Método', 'Operaciones', 'Total']],
    body: report.payment_methods.map((item) => [
      paymentLabel(item.method),
      String(item.operations),
      moneyFormatter.format(item.total),
    ]),
    styles: { fontSize: 8 },
  })
  document.save(`bazar-${report.date}.pdf`)
}

export function receiptText(sale: Sale) {
  const lines = sale.items.map(
    (item) => `${item.quantity} x ${item.product_name} - ${moneyFormatter.format(item.total)}`,
  )
  return [
    'DOFER - Venta de bazar',
    sale.bazar_name,
    new Date(sale.sold_at).toLocaleString('es-MX'),
    '',
    ...lines,
    '',
    `Total: ${moneyFormatter.format(sale.total)}`,
    `Pago: ${paymentLabel(sale.payment_method)}`,
    `Folio: ${sale.external_id}`,
  ].join('\n')
}

export function printReceipt(sale: Sale) {
  const popup = window.open('', '_blank', 'width=420,height=720')
  if (!popup) return
  const items = sale.items
    .map(
      (item) =>
        `<tr><td>${item.quantity} x ${escapeHTML(item.product_name)}</td><td>${moneyFormatter.format(item.total)}</td></tr>`,
    )
    .join('')
  popup.document.write(`<!doctype html><html><head><title>${escapeHTML(sale.external_id)}</title>
    <style>body{font-family:Arial,sans-serif;max-width:320px;margin:24px auto;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #ddd}td:last-child{text-align:right}.total{font-size:20px;font-weight:700;text-align:right;margin-top:16px}@media print{button{display:none}}</style>
    </head><body><h1>DOFER · Venta de bazar</h1><p>${escapeHTML(sale.bazar_name)}<br>${new Date(sale.sold_at).toLocaleString('es-MX')}</p><table>${items}</table><p class="total">${moneyFormatter.format(sale.total)}</p><p>${escapeHTML(paymentLabel(sale.payment_method))}<br>${escapeHTML(sale.external_id)}</p><button onclick="window.print()">Imprimir</button></body></html>`)
  popup.document.close()
  popup.focus()
}
