'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import CalculadoraCostos from '@/components/CalculadoraCostos'

interface QuoteItem {
  id?: string // ID del backend (solo en modo edición)
  product_name: string
  description: string
  weight_grams: number
  print_time_hours: number
  quantity: number
  other_costs: number
  unit_price: number
  total: number
}

interface QuoteSummary {
  id: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  notes?: string
  valid_until: string
  created_at: string
}

interface QuoteItemAPI {
  id: string
  product_name: string
  description?: string
  weight_grams: number
  print_time_hours: number
  quantity: number
  other_costs?: number
  unit_price: number
  total: number
}

interface QuoteDetailResponse {
  quote: QuoteSummary
  items?: QuoteItemAPI[] | null
}

interface CreateQuoteResponse {
  id: string
}

interface CostBreakdown {
  unit_price: number
  total: number
}

interface QuoteItemPayload {
  product_name: string
  description: string
  weight_grams: number
  print_time_hours: number
  quantity: number
  other_costs: number
  unit_price?: number
}

function mapQuoteItemFromAPI(item: QuoteItemAPI): QuoteItem {
  return {
    id: item.id,
    product_name: item.product_name,
    description: item.description || '',
    weight_grams: item.weight_grams,
    print_time_hours: item.print_time_hours,
    quantity: item.quantity,
    other_costs: item.other_costs || 0,
    unit_price: item.unit_price,
    total: item.total,
  }
}

function NewQuotePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editMode = searchParams.get('edit')
  
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  // Step 1: Customer info
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [validDays, setValidDays] = useState(15)

  // Step 2: Items
  const [items, setItems] = useState<QuoteItem[]>([])
  const [pricingMode, setPricingMode] = useState<'auto' | 'manual'>('auto')
  const [customPrice, setCustomPrice] = useState<number>(0)
  const [currentItem, setCurrentItem] = useState({
    product_name: '',
    description: '',
    weight_grams: 0,
    print_time_hours: 0,
    quantity: 1,
    other_costs: 0,
  })

  // Load existing quote if in edit mode
  useEffect(() => {
    if (editMode) {
      loadQuoteForEdit(editMode)
    }
  }, [editMode])

  const loadQuoteForEdit = async (quoteIdToEdit: string) => {
    try {
      setLoading(true)
      const response = await apiClient.get<QuoteDetailResponse>(`/quotes/${quoteIdToEdit}`)
      const quote = response.quote
      const existingItems = response.items || []

      // Set customer info
      setCustomerName(quote.customer_name)
      setCustomerEmail(quote.customer_email || '')
      setCustomerPhone(quote.customer_phone || '')
      setNotes(quote.notes || '')
      
      // Calcular valid_days aproximado
      const validUntil = new Date(quote.valid_until)
      const createdAt = new Date(quote.created_at)
      const diffDays = Math.ceil((validUntil.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      setValidDays(diffDays > 0 ? diffDays : 15)

      // Load existing items
      const formattedItems: QuoteItem[] = existingItems.map(mapQuoteItemFromAPI)
      setItems(formattedItems)

      setQuoteId(quoteIdToEdit)
      setIsEditMode(true)
      setStep(2) // Go directly to items step
    } catch (error: unknown) {
      console.error('Error loading quote:', error)
      alert('Error al cargar cotización para editar')
      router.push('/dashboard/quotes')
    } finally {
      setLoading(false)
    }
  }

  const updateQuote = async () => {
    if (!customerName) {
      alert('Por favor completa el nombre del cliente')
      return
    }

    try {
      setLoading(true)
      // Update customer info via API
      await apiClient.patch(`/quotes/${quoteId}`, {
        customer_name: customerName,
        customer_email: customerEmail || '',
        customer_phone: customerPhone,
        notes: notes,
      })
      
      alert('✅ Información del cliente actualizada')
    } catch (error: unknown) {
      console.error('Error updating quote:', error)
      alert(`Error al actualizar cotización: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setLoading(false)
    }
  }

  const createQuote = async () => {
    if (!customerName) {
      alert('Por favor completa el nombre del cliente')
      return
    }

    try {
      setLoading(true)
      const response = await apiClient.post<CreateQuoteResponse>('/quotes', {
        customer_name: customerName,
        customer_email: customerEmail || '',
        customer_phone: customerPhone,
        notes: notes,
        valid_days: validDays,
      })
      
      setQuoteId(response.id)
      setStep(2)
    } catch (error: unknown) {
      console.error('Error creating quote:', error)
      const message = getErrorMessage(error, 'Error desconocido')
      
      // Mensaje más específico dependiendo del error
      if (message.includes('fetch') || message.includes('Failed to fetch')) {
        alert('❌ No se puede conectar al servidor.\n\nEl backend API no está corriendo.\n\nPara crear cotizaciones necesitas:\n1. Configurar la base de datos (Supabase o Docker)\n2. Iniciar el backend: cd dofer-panel-api && go run cmd/api/main.go')
      } else {
        alert(`Error al crear cotización: ${message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const addItemToQuote = async (breakdown?: CostBreakdown) => {
    if (!quoteId) {
      alert('Por favor crea la cotización primero (Paso 1)')
      return
    }
    if (!currentItem.product_name) {
      alert('Por favor completa el nombre del producto')
      return
    }

    try {
      setLoading(true)
      
      // Determinar precio basado en modo
      let finalUnitPrice = 0
      let finalTotal = 0

      if (pricingMode === 'manual') {
        // Precio personalizado
        if (customPrice <= 0) {
          alert('Por favor ingresa un precio válido mayor a 0')
          return
        }
        finalUnitPrice = customPrice
        finalTotal = customPrice * currentItem.quantity
      } else {
        // Cálculo automático
        if (!breakdown) {
          alert('Calcula el precio primero con el botón azul')
          return
        }
        finalUnitPrice = breakdown.unit_price
        finalTotal = breakdown.total
      }

      // Enviar con precio personalizado si aplica
      const itemData: QuoteItemPayload = {
        product_name: currentItem.product_name,
        description: currentItem.description,
        weight_grams: currentItem.weight_grams,
        print_time_hours: currentItem.print_time_hours,
        quantity: currentItem.quantity,
        other_costs: currentItem.other_costs,
      }

      // Si es precio manual, enviar el precio personalizado
      if (pricingMode === 'manual') {
        itemData.unit_price = finalUnitPrice
      }

      await apiClient.post(`/quotes/${quoteId}/items`, itemData)

      // Si estamos en modo edición, recargar la cotización para obtener totales actualizados
      if (isEditMode) {
        const response = await apiClient.get<QuoteDetailResponse>(`/quotes/${quoteId}`)
        const existingItems = response.items || []
        const formattedItems: QuoteItem[] = existingItems.map(mapQuoteItemFromAPI)
        setItems(formattedItems)
      } else {
        // En modo creación, agregar al estado local
        const newItem: QuoteItem = {
          ...currentItem,
          unit_price: finalUnitPrice,
          total: finalTotal,
        }
        setItems([...items, newItem])
      }

      // Reset form
      setCurrentItem({
        product_name: '',
        description: '',
        weight_grams: 0,
        print_time_hours: 0,
        quantity: 1,
        other_costs: 0,
      })
      setCustomPrice(0)

      alert('✅ Item agregado exitosamente')
    } catch (error: unknown) {
      console.error('Error adding item:', error)
      alert(`Error al agregar item: ${getErrorMessage(error, 'Error desconocido')}`)
    } finally {
      setLoading(false)
    }
  }

  const removeItem = async (index: number) => {
    const item = items[index]
    
    // Si estamos en modo edición y el item tiene ID del backend, eliminarlo del servidor
    if (isEditMode && item.id && quoteId) {
      try {
        setLoading(true)
        await apiClient.delete(`/quotes/${quoteId}/items/${item.id}`)
        
        // Recargar la cotización para obtener los totales actualizados
        const response = await apiClient.get<QuoteDetailResponse>(`/quotes/${quoteId}`)
        const existingItems = response.items || []
        const formattedItems: QuoteItem[] = existingItems.map(mapQuoteItemFromAPI)
        setItems(formattedItems)
        
        alert('✅ Item eliminado')
      } catch (error: unknown) {
        console.error('Error deleting item:', error)
        alert(`Error al eliminar item: ${getErrorMessage(error, 'Error desconocido')}`)
      } finally {
        setLoading(false)
      }
    } else {
      // En modo creación, solo eliminar del estado local
      setItems(items.filter((_, i) => i !== index))
      alert('✅ Item eliminado')
    }
  }

  const editItem = (index: number) => {
    const itemToEdit = items[index]
    setCurrentItem({
      product_name: itemToEdit.product_name,
      description: itemToEdit.description,
      weight_grams: itemToEdit.weight_grams,
      print_time_hours: itemToEdit.print_time_hours,
      quantity: itemToEdit.quantity,
      other_costs: itemToEdit.other_costs,
    })
    setCustomPrice(itemToEdit.unit_price)
    setPricingMode('manual')
    removeItem(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    alert('Item cargado para editar. Actualiza y haz clic en Agregar.')
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
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? '✏️ Editar Cotización' : '📝 Nueva Cotización'}
          </h1>
          <p className="text-gray-600">
            {isEditMode ? 'Actualiza la información de la cotización' : 'Crea una cotización para un cliente'}
          </p>
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
                Email (opcional)
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
            onClick={isEditMode ? updateQuote : createQuote}
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : isEditMode ? 'Actualizar y Continuar →' : 'Continuar →'}
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
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{formatCurrency(item.unit_price)}/u</p>
                        <p className="font-bold text-gray-900">{formatCurrency(item.total)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => editItem(index)}
                          className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm font-medium"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => removeItem(index)}
                          className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm font-medium"
                        >
                          🗑️
                        </button>
                      </div>
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

            {/* Pricing Mode Toggle */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-200">
              <label className="block text-sm font-bold text-black mb-3">💰 Modo de Precio</label>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setPricingMode('auto')
                    setCustomPrice(0)
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                    pricingMode === 'auto'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  📊 Cálculo Automático
                </button>
                <button
                  onClick={() => setPricingMode('manual')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                    pricingMode === 'manual'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  💵 Precio Personalizado
                </button>
              </div>
            </div>

            {/* Inline Calculator or Custom Price */}
            <div className="border-t pt-6">
              {pricingMode === 'auto' ? (
                <CalculadoraCostos 
                  onCalculated={(breakdown) => {
                    if (currentItem.product_name && currentItem.weight_grams && currentItem.print_time_hours) {
                      addItemToQuote(breakdown)
                    } else {
                      alert('Completa nombre, peso y tiempo de impresión')
                    }
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      Precio Unitario (MXN) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customPrice || ''}
                        onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                        placeholder="0.00"
                      />
                      <button
                        onClick={() => addItemToQuote()}
                        disabled={loading || !customPrice}
                        className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        ➕ Agregar
                      </button>
                    </div>
                    {customPrice > 0 && (
                      <p className="text-sm text-gray-600 mt-2">
                        Total: {formatCurrency(customPrice * currentItem.quantity)}
                      </p>
                    )}
                  </div>
                </div>
              )}
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

export default function NewQuotePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Cargando...</div>
      </div>
    }>
      <NewQuotePageContent />
    </Suspense>
  )
}
