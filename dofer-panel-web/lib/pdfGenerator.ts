import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { Quote, QuoteItem } from '@/types'

export function generateQuotePDF(quote: Quote) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.width
  let yPosition = 20

  // Header - Logo y título
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('DOFER', 20, yPosition)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Impresión 3D Profesional', 20, yPosition + 5)

  // Número de cotización (derecha)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(quote.quote_number || 'SIN NÚMERO', pageWidth - 20, yPosition, { align: 'right' })
  
  // Estado
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const statusLabels: { [key: string]: string } = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    expired: 'Expirada'
  }
  doc.text(`Estado: ${statusLabels[quote.status]}`, pageWidth - 20, yPosition + 6, { align: 'right' })

  yPosition += 20

  // Línea separadora
  doc.setDrawColor(200, 200, 200)
  doc.line(20, yPosition, pageWidth - 20, yPosition)
  yPosition += 10

  // Información del cliente
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('DATOS DEL CLIENTE', 20, yPosition)
  yPosition += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nombre: ${quote.customer_name}`, 20, yPosition)
  yPosition += 5
  doc.text(`Email: ${quote.customer_email}`, 20, yPosition)
  yPosition += 5
  if (quote.customer_phone) {
    doc.text(`Teléfono: ${quote.customer_phone}`, 20, yPosition)
    yPosition += 5
  }

  yPosition += 5

  // Fechas
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(`Fecha de emisión: ${formatDate(quote.created_at)}`, 20, yPosition)
  yPosition += 4
  doc.text(`Válida hasta: ${formatDate(quote.valid_until)}`, 20, yPosition)
  yPosition += 10

  doc.setTextColor(0, 0, 0)

  // Notas (si existen)
  if (quote.notes) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    const splitNotes = doc.splitTextToSize(`Notas: ${quote.notes}`, pageWidth - 40)
    doc.text(splitNotes, 20, yPosition)
    yPosition += splitNotes.length * 5 + 5
  }

  // Tabla de items
  if (quote.items && quote.items.length > 0) {
    const tableData = quote.items.map((item: QuoteItem) => [
      item.product_name + (item.description ? `\n${item.description}` : ''),
      `${item.weight_grams}g\n${item.print_time_hours}h`,
      item.quantity.toString(),
      formatCurrency(item.unit_price),
      formatCurrency(item.total)
    ])

    ;(doc as any).autoTable({
      startY: yPosition,
      head: [['Producto', 'Especificaciones', 'Cant.', 'Precio Unit.', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229], // Indigo
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 20, right: 20 }
    })

    yPosition = (doc as any).lastAutoTable.finalY + 10
  }

  // Totales
  const totalsX = pageWidth - 70
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  doc.text('Subtotal:', totalsX, yPosition)
  doc.text(formatCurrency(quote.subtotal), pageWidth - 20, yPosition, { align: 'right' })
  yPosition += 6

  doc.text('IVA (16%):', totalsX, yPosition)
  doc.text(formatCurrency(quote.tax), pageWidth - 20, yPosition, { align: 'right' })
  yPosition += 8

  // Total con fondo
  doc.setFillColor(79, 70, 229)
  doc.rect(totalsX - 5, yPosition - 5, 75, 10, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL:', totalsX, yPosition)
  doc.text(formatCurrency(quote.total), pageWidth - 20, yPosition, { align: 'right' })
  
  doc.setTextColor(0, 0, 0)
  yPosition += 20

  // Footer
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  const footerY = doc.internal.pageSize.height - 20
  doc.text('Gracias por tu confianza en DOFER', pageWidth / 2, footerY, { align: 'center' })
  doc.text('Esta cotización es válida únicamente hasta la fecha indicada', pageWidth / 2, footerY + 4, { align: 'center' })

  // Guardar PDF
  doc.save(`Cotizacion_${quote.quote_number}.pdf`)
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
