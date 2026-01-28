import jsPDF from 'jspdf'
import { Quote, QuoteItem, Order, OrderItem } from '@/types'

export function generateQuotePDF(quote: Quote) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height
  const margin = 15
  let yPosition = 15

  // Colores DOFER
  const colorDark = { r: 0, g: 61, b: 102 }     // Azul oscuro
  const colorYellow = { r: 255, g: 184, b: 0 }  // Amarillo

  // ==================== ENCABEZADO ====================
  // Fondo azul oscuro del encabezado
  doc.setFillColor(colorDark.r, colorDark.g, colorDark.b)
  doc.rect(0, 0, pageWidth, 35, 'F')

  // Decoración amarilla lateral
  doc.setFillColor(colorYellow.r, colorYellow.g, colorYellow.b)
  doc.rect(0, 0, 4, 35, 'F')

  // Logo y nombre
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('DOFER', margin, 20)

  // Subtítulo
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 200, 100)
  doc.text('Soluciones de Impresión 3D', margin, 27)

  // Número de cotización (derecha)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  const quoteTitleX = pageWidth - margin
  doc.text(quote.quote_number || 'SIN NÚMERO', quoteTitleX, 16, { align: 'right' })

  // Estado badge
  const statusLabels: { [key: string]: string } = {
    pending: 'PENDIENTE',
    approved: 'APROBADA',
    rejected: 'RECHAZADA',
    expired: 'EXPIRADA'
  }
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  const statusBg: { [key: string]: [number, number, number] } = {
    pending: [colorYellow.r, colorYellow.g, colorYellow.b],
    approved: [76, 175, 80],
    rejected: [244, 67, 54],
    expired: [158, 158, 158]
  }
  
  const statusColor = statusBg[quote.status] || [158, 158, 158]
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
  doc.rect(pageWidth - margin - 45, 23, 42, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(statusLabels[quote.status], pageWidth - margin - 24, 27.5, { align: 'center' })

  yPosition = 42

  // ==================== INFORMACIÓN DEL CLIENTE ====================
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('INFORMACIÓN DEL CLIENTE', margin, yPosition)
  yPosition += 1
  
  // Línea con color DOFER
  doc.setDrawColor(colorDark.r, colorDark.g, colorDark.b)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  // Datos en dos columnas
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const col1X = margin
  const col2X = pageWidth / 2 + 5

  doc.setTextColor(100, 100, 100)
  doc.text('Nombre:', col1X, yPosition)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(quote.customer_name, col1X + 25, yPosition)

  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Teléfono:', col2X, yPosition)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(quote.customer_phone || 'N/A', col2X + 25, yPosition)

  yPosition += 5
  // Mostrar email solo si existe
  if (quote.customer_email) {
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'normal')
    doc.text('Email:', col1X, yPosition)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(quote.customer_email, col1X + 25, yPosition)
  }

  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Fecha:', col2X, yPosition)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(formatDate(quote.created_at), col2X + 25, yPosition)

  yPosition += 7

  // Notas (si existen)
  if (quote.notes) {
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Notas:', col1X, yPosition)
    yPosition += 3
    const splitNotes = doc.splitTextToSize(quote.notes, pageWidth - 2 * margin - 25)
    doc.setTextColor(0, 0, 0)
    doc.text(splitNotes, col1X + 25, yPosition)
    yPosition += splitNotes.length * 3 + 2
  }

  yPosition += 5

  // ==================== TABLA DE ITEMS ====================
  if (quote.items && quote.items.length > 0) {
    yPosition = drawTableImproved(doc, quote.items, yPosition)
  } else {
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text('No hay items en esta cotización', margin, yPosition)
    yPosition += 10
  }

  // ==================== TOTALES ====================
  yPosition += 5

  const totalsX = pageWidth - margin - 80
  const totalsBoxWidth = 75
  const totalsBoxHeight = 30

  // Fondo gris claro para totales
  doc.setFillColor(245, 245, 245)
  doc.rect(totalsX - 5, yPosition - 2, totalsBoxWidth + 10, totalsBoxHeight + 2, 'F')
  
  // Borde en color DOFER
  doc.setDrawColor(colorDark.r, colorDark.g, colorDark.b)
  doc.setLineWidth(1)
  doc.rect(totalsX - 5, yPosition - 2, totalsBoxWidth + 10, totalsBoxHeight + 2)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('Subtotal:', totalsX, yPosition + 3)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(quote.subtotal), pageWidth - margin - 5, yPosition + 3, { align: 'right' })

  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('IVA (16%):', totalsX, yPosition + 8)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(quote.tax), pageWidth - margin - 5, yPosition + 8, { align: 'right' })

  // Total con fondo azul DOFER
  doc.setFillColor(colorDark.r, colorDark.g, colorDark.b)
  doc.rect(totalsX - 5, yPosition + 11, totalsBoxWidth + 10, 8, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL:', totalsX, yPosition + 15)
  doc.text(formatCurrency(quote.total), pageWidth - margin - 5, yPosition + 15, { align: 'right' })

  // ==================== FOOTER ====================
  const footerY = pageHeight - 12
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(150, 150, 150)
  
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3)
  doc.text('Documento de cotización - DOFER Soluciones de Impresión 3D', pageWidth / 2, footerY, { align: 'center' })
  doc.text('Gracias por tu confianza', pageWidth / 2, footerY + 4, { align: 'center' })

  // Guardar PDF
  doc.save(`Cotizacion_${quote.quote_number}.pdf`)
}

// Función para dibujar tabla mejorada
function drawTableImproved(doc: jsPDF, items: QuoteItem[], startY: number): number {
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height
  const margin = 15
  const availableWidth = pageWidth - 2 * margin
  
  // Distribuir el ancho disponible proporcionalmente
  const colWidth1 = availableWidth * 0.35  // Producto: 35%
  const colWidth2 = availableWidth * 0.20  // Especificaciones: 20%
  const colWidth3 = availableWidth * 0.10  // Cantidad: 10%
  const colWidth4 = availableWidth * 0.175 // Precio Unitario: 17.5%
  const colWidth5 = availableWidth * 0.175 // Total: 17.5%
  
  let yPosition = startY
  const rowHeight = 8
  const headerHeight = 7

  // Colores DOFER
  const colorDark = { r: 0, g: 61, b: 102 }

  // Encabezado de la tabla con color DOFER
  doc.setFillColor(colorDark.r, colorDark.g, colorDark.b)
  doc.rect(margin, yPosition, availableWidth, headerHeight, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  
  const padding = 2
  const col1X = margin + padding
  const col2X = col1X + colWidth1
  const col3X = col2X + colWidth2
  const col4X = col3X + colWidth3
  const col5X = col4X + colWidth4

  doc.text('Producto', col1X, yPosition + 4.5)
  doc.text('Especificaciones', col2X + padding, yPosition + 4.5)
  doc.text('Cant.', col3X + padding, yPosition + 4.5, { align: 'center' })
  doc.text('Precio Unit.', col4X + padding, yPosition + 4.5, { align: 'right' })
  doc.text('Total', col5X + padding, yPosition + 4.5, { align: 'right' })

  yPosition += headerHeight + 1

  // Filas de datos
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  items.forEach((item, index) => {
    // Alternar colores de fila
    if (index % 2 === 0) {
      doc.setFillColor(248, 248, 252)
      doc.rect(margin, yPosition, availableWidth, rowHeight, 'F')
    }

    // Bordes
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.rect(margin, yPosition, availableWidth, rowHeight)

    // Contenido
    const productText = item.product_name + (item.description ? ` (${item.description})` : '')
    const specText = `${item.weight_grams}g / ${item.print_time_hours}h`
    
    doc.setTextColor(20, 20, 20)
    doc.text(productText, col1X, yPosition + 2.8, { maxWidth: colWidth1 - 2 * padding })
    doc.text(specText, col2X + padding, yPosition + 2.8, { maxWidth: colWidth2 - 2 * padding })
    doc.text(item.quantity.toString(), col3X + padding, yPosition + 2.8, { align: 'center' })
    
    doc.setFont('helvetica', 'bold')
    doc.text(formatCurrency(item.unit_price), col4X + padding, yPosition + 2.8, { align: 'right', maxWidth: colWidth4 - 2 * padding })
    doc.text(formatCurrency(item.total), col5X + padding, yPosition + 2.8, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    yPosition += rowHeight

    // Si se acerca al final de la página, agregar página nueva
    if (yPosition > pageHeight - 60) {
      doc.addPage()
      yPosition = 15
    }
  })

  return yPosition
}

// Función auxiliar para formatear fechas
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Función auxiliar para formatear moneda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value)
}

// ============= GENERADOR DE PDF PARA PEDIDOS =============

export function generateOrderPDF(order: Order, items?: OrderItem[], payments?: any[]) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height
  const margin = 15
  let yPosition = 15

  // Colores DOFER
  const colorDark = { r: 0, g: 61, b: 102 }     // Azul oscuro
  const colorYellow = { r: 255, g: 184, b: 0 }  // Amarillo

  // ==================== ENCABEZADO ====================
  // Fondo azul oscuro del encabezado
  doc.setFillColor(colorDark.r, colorDark.g, colorDark.b)
  doc.rect(0, 0, pageWidth, 35, 'F')

  // Decoración amarilla lateral
  doc.setFillColor(colorYellow.r, colorYellow.g, colorYellow.b)
  doc.rect(0, 0, 4, 35, 'F')

  // Logo y nombre
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('DOFER', margin, 20)

  // Subtítulo
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 200, 100)
  doc.text('Soluciones de Impresión 3D', margin, 27)

  // Número de orden (derecha)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  const orderTitleX = pageWidth - margin
  doc.text(order.order_number || 'SIN NÚMERO', orderTitleX, 16, { align: 'right' })

  // Estado badge
  const statusLabels: { [key: string]: string } = {
    new: 'NUEVO',
    printing: 'IMPRIMIENDO',
    post: 'POST-PROCESO',
    packed: 'EMPAQUETADO',
    ready: 'LISTO',
    delivered: 'ENTREGADO',
    cancelled: 'CANCELADO'
  }
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  const statusBg: { [key: string]: [number, number, number] } = {
    new: [59, 130, 246],
    printing: [147, 51, 234],
    post: [234, 179, 8],
    packed: [168, 85, 247],
    ready: [34, 197, 94],
    delivered: [16, 185, 129],
    cancelled: [239, 68, 68]
  }
  
  const statusColor = statusBg[order.status] || [158, 158, 158]
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
  doc.rect(pageWidth - margin - 45, 23, 42, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(statusLabels[order.status], pageWidth - margin - 24, 27.5, { align: 'center' })

  yPosition = 42

  // ==================== INFORMACIÓN DEL PEDIDO ====================
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('INFORMACIÓN DEL PEDIDO', margin, yPosition)
  yPosition += 1
  
  // Línea con color DOFER
  doc.setDrawColor(colorDark.r, colorDark.g, colorDark.b)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  // Datos en dos columnas
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const col1X = margin
  const col2X = pageWidth / 2 + 5

  // Fila 1: Cliente y Teléfono
  doc.setTextColor(100, 100, 100)
  doc.text('Cliente:', col1X, yPosition)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(order.customer_name, col1X + 25, yPosition)

  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Teléfono:', col2X, yPosition)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(order.customer_phone || 'N/A', col2X + 25, yPosition)

  yPosition += 5

  // Fila 2: Email (si existe) y Fecha
  if (order.customer_email) {
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'normal')
    doc.text('Email:', col1X, yPosition)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(order.customer_email, col1X + 25, yPosition)
  }

  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Fecha:', col2X, yPosition)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(formatDate(order.created_at), col2X + 25, yPosition)

  yPosition += 5

  // Fila 3: Plataforma y Prioridad
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Plataforma:', col1X, yPosition)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(order.platform.toUpperCase(), col1X + 25, yPosition)

  const priorityLabels: { [key: string]: string } = {
    urgent: '🔴 URGENTE',
    normal: '🟡 NORMAL',
    low: '🟢 BAJA'
  }
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Prioridad:', col2X, yPosition)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(priorityLabels[order.priority] || order.priority.toUpperCase(), col2X + 25, yPosition)

  yPosition += 5

  // Fila 4: Producto y Cantidad
  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Producto:', col1X, yPosition)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  const productText = doc.splitTextToSize(order.product_name, pageWidth / 2 - col1X - 30)
  doc.text(productText, col1X + 25, yPosition)

  doc.setTextColor(100, 100, 100)
  doc.setFont('helvetica', 'normal')
  doc.text('Cantidad:', col2X, yPosition)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(`${order.quantity} unidades`, col2X + 25, yPosition)

  yPosition += productText.length * 4 + 2

  // Asignado a (si existe)
  if (order.assigned_to) {
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'normal')
    doc.text('Asignado a:', col1X, yPosition)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(order.assigned_to, col1X + 25, yPosition)
    yPosition += 5
  }

  // Notas (si existen)
  if (order.notes) {
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Notas:', col1X, yPosition)
    yPosition += 3
    const splitNotes = doc.splitTextToSize(order.notes, pageWidth - 2 * margin - 25)
    doc.setTextColor(0, 0, 0)
    doc.text(splitNotes, col1X + 25, yPosition)
    yPosition += splitNotes.length * 3 + 2
  }

  yPosition += 5

  // ==================== TABLA DE ITEMS ====================
  if (items && items.length > 0) {
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('ITEMS DEL PEDIDO', margin, yPosition)
    yPosition += 1
    
    doc.setDrawColor(colorDark.r, colorDark.g, colorDark.b)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 5

    yPosition = drawOrderItemsTable(doc, items, yPosition)
  }

  yPosition += 5

  // ==================== INFORMACIÓN DE PAGOS ====================
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('INFORMACIÓN DE PAGO', margin, yPosition)
  yPosition += 1
  
  doc.setDrawColor(colorDark.r, colorDark.g, colorDark.b)
  doc.setLineWidth(0.5)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  const totalsX = pageWidth - margin - 80
  const totalsBoxWidth = 75
  const totalsBoxHeight = 35

  // Fondo gris claro para totales
  doc.setFillColor(245, 245, 245)
  doc.rect(totalsX - 5, yPosition - 2, totalsBoxWidth + 10, totalsBoxHeight + 2, 'F')
  
  // Borde en color DOFER
  doc.setDrawColor(colorDark.r, colorDark.g, colorDark.b)
  doc.setLineWidth(1)
  doc.rect(totalsX - 5, yPosition - 2, totalsBoxWidth + 10, totalsBoxHeight + 2)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('Monto Total:', totalsX, yPosition + 3)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(order.amount || 0), pageWidth - margin - 5, yPosition + 3, { align: 'right' })

  // Pagado - destacado en verde
  doc.setTextColor(22, 163, 74)  // Verde
  doc.setFont('helvetica', 'normal')
  doc.text('Pagado:', totalsX, yPosition + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(formatCurrency(order.amount_paid || 0), pageWidth - margin - 5, yPosition + 8, { align: 'right' })

  // Balance con fondo destacado
  const balanceColor = order.balance > 0 ? [220, 38, 38] : [22, 163, 74]
  doc.setFillColor(balanceColor[0], balanceColor[1], balanceColor[2])
  doc.rect(totalsX - 5, yPosition + 11, totalsBoxWidth + 10, 8, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('BALANCE:', totalsX, yPosition + 15)
  doc.text(formatCurrency(order.balance || 0), pageWidth - margin - 5, yPosition + 15, { align: 'right' })

  // Estado de pago
  yPosition += 22
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  const paymentStatus = order.balance <= 0 ? '✅ Pagado completamente' : '⚠️ Pago pendiente'
  doc.text(paymentStatus, totalsX, yPosition)

  // Lista de pagos (si existen)
  if (payments && payments.length > 0) {
    yPosition += 10
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('💰 Historial de Pagos Realizados:', margin, yPosition)
    yPosition += 1
    
    doc.setDrawColor(colorDark.r, colorDark.g, colorDark.b)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 5

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    
    // Encabezado de tabla de pagos
    doc.setTextColor(100, 100, 100)
    doc.text('Fecha', margin + 5, yPosition)
    doc.text('Monto', margin + 55, yPosition)
    doc.text('Método', margin + 105, yPosition)
    doc.text('Notas', margin + 145, yPosition)
    yPosition += 5
    
    // Linea separadora
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(margin, yPosition - 1, pageWidth - margin, yPosition - 1)
    
    doc.setTextColor(0, 0, 0)
    payments.forEach((payment, index) => {
      // Fondo alternado
      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252)
        doc.rect(margin, yPosition - 2, pageWidth - 2 * margin, 5, 'F')
      }
      
      const paymentDate = new Date(payment.payment_date).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      
      doc.setFont('helvetica', 'normal')
      doc.text(paymentDate, margin + 5, yPosition)
      
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(22, 163, 74)  // Verde para el monto
      doc.text(formatCurrency(payment.amount), margin + 55, yPosition)
      
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.text((payment.payment_method || 'N/A').toUpperCase(), margin + 105, yPosition)
      
      if (payment.notes) {
        const notesText = doc.splitTextToSize(payment.notes, 50)
        doc.text(notesText[0], margin + 145, yPosition)
      } else {
        doc.text('-', margin + 145, yPosition)
      }
      
      yPosition += 5
    })
    
    // Total de pagos realizados
    yPosition += 3
    doc.setDrawColor(colorDark.r, colorDark.g, colorDark.b)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition - 1, pageWidth - margin, yPosition - 1)
    yPosition += 4
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(22, 163, 74)
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    doc.text('TOTAL PAGADO:', margin + 5, yPosition)
    doc.text(formatCurrency(totalPaid), margin + 55, yPosition)
  }

  // ==================== FOOTER ====================
  const footerY = pageHeight - 12
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(150, 150, 150)
  
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3)
  doc.text('Documento de pedido - DOFER Soluciones de Impresión 3D', pageWidth / 2, footerY, { align: 'center' })
  doc.text(`ID de Seguimiento: ${order.public_id}`, pageWidth / 2, footerY + 4, { align: 'center' })

  // Guardar PDF
  doc.save(`Pedido_${order.order_number}.pdf`)
}

// Función para dibujar tabla de items de pedido
function drawOrderItemsTable(doc: jsPDF, items: OrderItem[], startY: number): number {
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height
  const margin = 15
  const availableWidth = pageWidth - 2 * margin
  
  // Distribuir el ancho disponible
  const colWidth1 = availableWidth * 0.35  // Producto: 35%
  const colWidth2 = availableWidth * 0.25  // Descripción: 25%
  const colWidth3 = availableWidth * 0.10  // Cantidad: 10%
  const colWidth4 = availableWidth * 0.15  // Precio Unit: 15%
  const colWidth5 = availableWidth * 0.15  // Total: 15%
  
  let yPosition = startY
  const rowHeight = 8
  const headerHeight = 7

  // Colores DOFER
  const colorDark = { r: 0, g: 61, b: 102 }

  // Encabezado de la tabla
  doc.setFillColor(colorDark.r, colorDark.g, colorDark.b)
  doc.rect(margin, yPosition, availableWidth, headerHeight, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  
  const padding = 2
  const col1X = margin + padding
  const col2X = col1X + colWidth1
  const col3X = col2X + colWidth2
  const col4X = col3X + colWidth3
  const col5X = col4X + colWidth4

  doc.text('Producto', col1X, yPosition + 4.5)
  doc.text('Descripción', col2X + padding, yPosition + 4.5)
  doc.text('Cant.', col3X + padding, yPosition + 4.5, { align: 'center' })
  doc.text('Precio Unit.', col4X + padding, yPosition + 4.5, { align: 'right' })
  doc.text('Total', col5X + padding, yPosition + 4.5, { align: 'right' })

  yPosition += headerHeight + 1

  // Filas de datos
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  items.forEach((item, index) => {
    // Alternar colores de fila
    if (index % 2 === 0) {
      doc.setFillColor(248, 248, 252)
      doc.rect(margin, yPosition, availableWidth, rowHeight, 'F')
    }

    // Bordes
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.rect(margin, yPosition, availableWidth, rowHeight)

    // Contenido
    const productText = item.product_name
    const descText = item.description || '-'
    
    doc.setTextColor(20, 20, 20)
    doc.text(productText, col1X, yPosition + 2.8, { maxWidth: colWidth1 - 2 * padding })
    doc.text(descText, col2X + padding, yPosition + 2.8, { maxWidth: colWidth2 - 2 * padding })
    doc.text(item.quantity.toString(), col3X + padding, yPosition + 2.8, { align: 'center' })
    
    doc.setFont('helvetica', 'bold')
    doc.text(formatCurrency(item.unit_price), col4X + padding, yPosition + 2.8, { align: 'right' })
    doc.text(formatCurrency(item.total), col5X + padding, yPosition + 2.8, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    // Marcar completado
    if (item.is_completed) {
      doc.setTextColor(34, 197, 94)
      doc.text('✓', margin + availableWidth - 8, yPosition + 2.8)
    }

    yPosition += rowHeight

    // Si se acerca al final de la página, agregar página nueva
    if (yPosition > pageHeight - 60) {
      doc.addPage()
      yPosition = 15
    }
  })

  return yPosition
}
