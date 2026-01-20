'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

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
}

export default function OrderLabel({
  orderNumber,
  customerName,
  customerPhone,
  customerEmail,
  publicId,
  items,
  createdAt,
  platform
}: OrderLabelProps) {
  const qrRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (qrRef.current) {
      const trackingUrl = `${window.location.origin}/track/${publicId}`
      QRCode.toCanvas(qrRef.current, trackingUrl, {
        width: 120,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
    }
  }, [publicId])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
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
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
        
        .order-label {
          width: 10cm;
          padding: 1cm;
          margin: 0 auto;
          background: white;
          border: 2px dashed #ccc;
          font-family: Arial, sans-serif;
        }
      `}</style>

      <div className="space-y-4">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-3">
          <h1 className="text-2xl font-bold">DOFER</h1>
          <p className="text-xs text-gray-600">Impresión 3D</p>
        </div>

        {/* Order Info */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-600">Pedido</p>
              <p className="text-lg font-bold">{orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">Fecha</p>
              <p className="text-sm font-semibold">{formatDate(createdAt)}</p>
            </div>
          </div>

          <div className="bg-gray-100 p-2 rounded">
            <p className="text-xs text-gray-600">Plataforma</p>
            <p className="text-sm font-semibold uppercase">{platform}</p>
          </div>
        </div>

        {/* Customer Info */}
        <div className="border-t border-gray-300 pt-3 space-y-1">
          <p className="text-xs text-gray-600 font-semibold">CLIENTE:</p>
          <p className="text-base font-bold">{customerName}</p>
          {customerPhone && (
            <p className="text-sm">📱 {customerPhone}</p>
          )}
          {customerEmail && (
            <p className="text-xs text-gray-600">{customerEmail}</p>
          )}
        </div>

        {/* Items */}
        <div className="border-t border-gray-300 pt-3">
          <p className="text-xs text-gray-600 font-semibold mb-2">CONTENIDO:</p>
          <div className="space-y-1">
            {items.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="truncate flex-1">
                  {item.product_name}
                  {item.description && ` - ${item.description.substring(0, 20)}`}
                </span>
                <span className="font-semibold ml-2">×{item.quantity}</span>
              </div>
            ))}
            {items.length > 5 && (
              <p className="text-xs text-gray-500 italic">
                +{items.length - 5} items más...
              </p>
            )}
            {items.length === 0 && (
              <p className="text-sm text-gray-500">Ver detalles en el sistema</p>
            )}
          </div>
        </div>

        {/* QR Code and Tracking */}
        <div className="border-t border-gray-300 pt-3 flex justify-between items-center">
          <div className="flex-1">
            <p className="text-xs text-gray-600 font-semibold">TRACKING:</p>
            <p className="text-xs font-mono break-all">{publicId}</p>
            <p className="text-xs text-gray-500 mt-1">
              Escanea el QR para rastrear
            </p>
          </div>
          <div className="ml-3">
            <canvas ref={qrRef} className="border border-gray-300" />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-300 pt-2 text-center">
          <p className="text-xs text-gray-500">
            ¡Gracias por tu compra!
          </p>
        </div>
      </div>
    </div>
  )
}
