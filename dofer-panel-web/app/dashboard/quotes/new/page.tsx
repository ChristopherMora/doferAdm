'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import CalculadoraCostos from '@/components/CalculadoraCostos'

interface QuoteItem {
  product_name: string
  description: string
  weight_grams: number
  print_time_hours: number
  quantity: number
  other_costs: number
  unit_price: number
  total: number
}

export default function NewQuotePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [quoteId, setQuoteId] = useState<string | null>(null)

  // Step 1: Customer info
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [validDays, setValidDays] = useState(15)

  // Step 2: Items
  const [items, setItems] = useState<QuoteItem[]>([])
  const [currentItem, setCurrentItem] = useState({
    product_name: '',
    description: '',
    weight_grams: 0,
    print_time_hours: 0,
    quantity: 1,
    other_costs: 0,
  })

  const createQuote = async () => {
    if (!customerName || !customerEmail) {
      alert('Por favor completa nombre y email del cliente')
      return
    }

    try {
      setLoading(true)
      const response = await apiClient.post<any>('/quotes', {
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        notes: notes,
        valid_days: validDays,
      })
      
      setQuoteId(response.id)
      setStep(2)
    } catch (error: any) {
      console.error('Error creating quote:', error)
      
      // Mensaje más específico dependiendo del error
      if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
        alert('❌ No se puede conectar al servidor.\n\nEl backend API no está corriendo.\n\nPara crear cotizaciones necesitas:\n1. Configurar la base de datos (Supabase o Docker)\n2. Iniciar el backend: cd dofer-panel-api && go run cmd/api/main.go')
      } else {
        alert(`Error al crear cotización: ${error.message || 'Error desconocido'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const addItemToQuote = async (breakdown: any) => {
    if (!quoteId) return

    try {
      setLoading(true)
      await apiClient.post(`/quotes/${quoteId}/items`, {
        product_name: currentItem.product_name,
        description: currentItem.description,
        weight_grams: currentItem.weight_grams,
        print_time_hours: currentItem.print_time_hours,
        quantity: currentItem.quantity,
        other_costs: currentItem.other_costs,
      })

      // Add to local list
      const newItem: QuoteItem = {
        ...currentItem,
        unit_price: breakdown.unit_price,
        total: breakdown.total,
      }
      setItems([...items, newItem])

      // Reset form
      setCurrentItem({
        product_name: '',
        description: '',
        weight_grams: 0,
        print_time_hours: 0,
        quantity: 1,
        other_costs: 0,
      })

      alert('✅ Item agregado exitosamente')
    } catch (error) {
      console.error('Error adding item:', error)
      alert('Error al agregar item')
    } finally {
      setLoading(false)
    }
  }

  const finishQuote = () => {
    if (items.length === 0) {
      alert('Agrega al menos un item a la cotización')
      return
    }
    router.push(`/dashboard/quotes/${quoteId}`)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value)
  }

  const totalQuote = items.reduce((sum, item) => sum + item.total, 0)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📝 Nueva Cotización</h1>
          <p className="text-gray-600">Crea una cotización para un cliente</p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900"
        >
          ← Volver
        </button>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center ${step >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-indigo-600 bg-indigo-100' : 'border-gray-300'}`}>
              1
            </div>
            <span className="ml-2 font-medium">Datos del Cliente</span>
          </div>
          <div className="w-16 h-0.5 bg-gray-300"></div>
          <div className={`flex items-center ${step >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-indigo-600 bg-indigo-100' : 'border-gray-300'}`}>
              2
            </div>
            <span className="ml-2 font-medium">Agregar Items</span>
          </div>
        </div>
      </div>

      {/* Step 1: Customer Info */}
      {step === 1 && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">👤 Información del Cliente</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Nombre del cliente *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                placeholder="Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Email *
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                placeholder="juan@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                placeholder="1234567890"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Válida por (días)
              </label>
              <input
                type="number"
                value={validDays}
                onChange={(e) => setValidDays(parseInt(e.target.value) || 15)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                placeholder="15"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-black mb-2">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
              placeholder="Notas adicionales..."
            />
          </div>

          <button
            onClick={createQuote}
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Continuar →'}
          </button>
        </div>
      )}

      {/* Step 2: Add Items */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Current Items */}
          {items.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📦 Items Agregados</h3>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.product_name}</p>
                      <p className="text-sm text-gray-600">
                        {item.weight_grams}g • {item.print_time_hours}h • Cantidad: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{formatCurrency(item.unit_price)}/u</p>
                      <p className="font-bold text-gray-900">{formatCurrency(item.total)}</p>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="text-lg font-bold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(totalQuote)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Add New Item Form */}
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">➕ Agregar Nuevo Item</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Nombre del producto *
                </label>
                <input
                  type="text"
                  value={currentItem.product_name}
                  onChange={(e) => setCurrentItem({ ...currentItem, product_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                  placeholder="Ej: Maceta decorativa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  value={currentItem.description}
                  onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                  placeholder="Detalles adicionales"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Peso (gramos) *
                </label>
                <input
                  type="number"
                  value={currentItem.weight_grams || ''}
                  onChange={(e) => setCurrentItem({ ...currentItem, weight_grams: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                  placeholder="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Tiempo de impresión (horas) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentItem.print_time_hours || ''}
                  onChange={(e) => setCurrentItem({ ...currentItem, print_time_hours: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                  placeholder="5.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Cantidad *
                </label>
                <input
                  type="number"
                  value={currentItem.quantity || ''}
                  onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                  placeholder="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Otros costos
                </label>
                <input
                  type="number"
                  value={currentItem.other_costs || ''}
                  onChange={(e) => setCurrentItem({ ...currentItem, other_costs: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Inline Calculator */}
            <div className="border-t pt-6">
              <CalculadoraCostos 
                onCalculated={(breakdown) => {
                  if (currentItem.product_name && currentItem.weight_grams && currentItem.print_time_hours) {
                    addItemToQuote(breakdown)
                  } else {
                    alert('Completa nombre, peso y tiempo de impresión')
                  }
                }}
              />
            </div>
          </div>

          {/* Finish Button */}
          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg hover:bg-gray-300"
            >
              ← Volver
            </button>
            <button
              onClick={finishQuote}
              disabled={items.length === 0}
              className="flex-1 bg-green-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              ✅ Finalizar Cotización
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
