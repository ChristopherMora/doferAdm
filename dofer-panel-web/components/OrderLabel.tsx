'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

interface OrderItem {
  product_name: string
  quantity: number
  description?: string
}

interface OrderLabelProps {
  orderNumber: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  publicId: string
  items: OrderItem[]
  createdAt: string
  platform: string
  priority?: string
  deliveryDeadline?: string
}

export default function OrderLabel({
  orderNumber,
  customerName,
  customerPhone,
  customerEmail,
  publicId,
  items,
  createdAt,
  platform,
  priority,
  deliveryDeadline
}: OrderLabelProps) {
  const qrRef = useRef<HTMLCanvasElement>(null)
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    // Generar QR code
    if (qrRef.current) {
      const trackingUrl = `${window.location.origin}/track/${publicId}`
      QRCode.toCanvas(qrRef.current, trackingUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
    }

    // Generar código de barras
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, orderNumber, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 14,
        margin: 5
      })
    }
  }, [publicId, orderNumber])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444'
      case 'high': return '#f97316'
      case 'normal': return '#3b82f6'
      default: return '#6b7280'
    }
  }

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '🔴 URGENTE'
      case 'high': return '🟠 ALTA'
      case 'normal': return '🔵 NORMAL'
      default: return '⚪ BAJA'
    }
  }

  return (
    <div className="order-label">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .order-label, .order-label * {
            visibility: visible;
          }
          .order-label {
            position: absolute;
            left: 0;
            top: 0;
            width: 4in;
            height: 6in;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: 4in 6in;
            margin: 0;
          }
        }
        
        .order-label {
          width: 4in;
          height: 6in;
          padding: 0.25in;
          margin: 0 auto;
          background: white;
          border: 3px dashed #ccc;
          font-family: 'Arial', sans-serif;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }

        .label-header {
          text-align: center;
          border-bottom: 3px solid #000;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }

        .label-company {
          font-size: 32px;
          font-weight: 900;
          letter-spacing: 2px;
          margin: 0;
        }

        .label-subtitle {
          font-size: 10px;
          color: #666;
          margin: 2px 0 0 0;
        }

        .priority-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 11px;
          margin-top: 6px;
          color: white;
        }

        .section {
          margin-bottom: 10px;
        }

        .section-title {
          font-size: 9px;
          font-weight: bold;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 4px;
          letter-spacing: 0.5px;
        }

        .section-content {
          font-size: 12px;
          font-weight: 600;
          color: #000;
          line-height: 1.3;
        }

        .items-list {
          border: 2px solid #000;
          border-radius: 4px;
          padding: 8px;
          background: #f9f9f9;
        }

        .item-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 4px;
          padding-bottom: 4px;
          border-bottom: 1px dashed #ccc;
        }

        .item-row:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .item-name {
          font-weight: bold;
          flex: 1;
        }

        .item-qty {
          font-weight: bold;
          color: #7c3aed;
          margin-left: 8px;
        }

        .qr-barcode-section {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: center;
          padding: 8px;
          background: #f9f9f9;
          border-radius: 8px;
          border: 2px solid #000;
          margin-top: auto;
        }

        .qr-container {
          text-align: center;
        }

        .barcode-container {
          flex: 1;
          text-align: center;
        }

        .tracking-text {
          font-size: 8px;
          color: #666;
          margin-top: 4px;
        }

        .footer-info {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          color: #666;
          margin-top: 8px;
          padding-top: 6px;
          border-top: 1px solid #ddd;
        }

        .deadline-box {
          background: #fef3c7;
          border: 2px solid #f59e0b;
          border-radius: 4px;
          padding: 6px;
          text-align: center;
          margin-bottom: 8px;
        }

        .deadline-label {
          font-size: 8px;
          font-weight: bold;
          color: #92400e;
          margin-bottom: 2px;
        }

        .deadline-date {
          font-size: 14px;
          font-weight: 900;
          color: #92400e;
        }
      `}</style>

      {/* Header */}
      <div className="label-header">
        <h1 className="label-company">DOFER</h1>
        <p className="label-subtitle">Impresión 3D Profesional</p>
        {priority && (
          <div 
            className="priority-badge" 
            style={{ backgroundColor: getPriorityColor(priority) }}
          >
            {getPriorityLabel(priority)}
          </div>
        )}
      </div>

      {/* Deadline Alert */}
      {deliveryDeadline && (
        <div className="deadline-box">
          <div className="deadline-label">⚠️ FECHA DE ENTREGA</div>
          <div className="deadline-date">{formatDate(deliveryDeadline)}</div>
        </div>
      )}

      {/* Cliente */}
      <div className="section">
        <div className="section-title">👤 Cliente</div>
        <div className="section-content">
          {customerName}
          {customerPhone && <div style={{ fontSize: '10px', color: '#666' }}>📱 {customerPhone}</div>}
          {customerEmail && <div style={{ fontSize: '10px', color: '#666' }}>📧 {customerEmail}</div>}
        </div>
      </div>

      {/* Items */}
      <div className="section">
        <div className="section-title">📦 Productos ({items.length})</div>
        <div className="items-list">
          {items.map((item, index) => (
            <div key={index} className="item-row">
              <span className="item-name">{item.product_name}</span>
              <span className="item-qty">×{item.quantity}</span>
            </div>
          ))}
        </div>
      </div>

      {/* QR y Código de Barras */}
      <div className="qr-barcode-section">
        <div className="qr-container">
          <canvas ref={qrRef} />
          <div className="tracking-text">
            Escanea para<br/>rastrear pedido
          </div>
        </div>
        
        <div className="barcode-container">
          <svg ref={barcodeRef}></svg>
        </div>
      </div>

      {/* Footer Info */}
      <div className="footer-info">
        <span>🏪 {platform.toUpperCase()}</span>
        <span>📅 {formatDate(createdAt)}</span>
        <span>🕒 {formatTime(createdAt)}</span>
      </div>
    </div>
  )
}
