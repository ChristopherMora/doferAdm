'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { useToast } from '@/components/ui/toast'
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

interface QuoteTemplate {
  id: string
  name: string
  description?: string
  material: string
  infill_percentage: number
  layer_height: number
  print_speed: number
  base_cost: number
  markup_percentage: number
}

interface QuoteTemplatesResponse {
  templates: QuoteTemplate[]
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

interface CustomerValidationErrors {
  customerName?: string
  customerEmail?: string
  validDays?: string
}

interface ItemValidationErrors {
  product_name?: string
  weight_grams?: string
  print_time_hours?: string
  quantity?: string
  customPrice?: string
}

interface QuoteDraft {
  customerName: string
  customerEmail: string
  customerPhone: string
  notes: string
  validDays: number
  items: QuoteItem[]
  pricingMode: 'auto' | 'manual'
  customPrice: number
  currentItem: {
    product_name: string
    description: string
    weight_grams: number
    print_time_hours: number
    quantity: number
    other_costs: number
  }
  selectedTemplateID: string
}

const DRAFT_STORAGE_KEY = 'dofer_quote_draft_v1'

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

function getSuggestedTemplateUnitPrice(template: QuoteTemplate): number {
  return Number((template.base_cost * (1 + template.markup_percentage / 100)).toFixed(2))
}

function getTemplateDescription(template: QuoteTemplate): string {
  return [
    template.description?.trim() || '',
    `Material: ${template.material}`,
    `Infill: ${template.infill_percentage}%`,
    `Capa: ${template.layer_height}mm`,
    `Velocidad: ${template.print_speed}mm/s`,
  ]
    .filter(Boolean)
    .join(' | ')
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validateCustomerFields({
  customerName,
  customerEmail,
  validDays,
}: {
  customerName: string
  customerEmail: string
  validDays: number
}): CustomerValidationErrors {
  const errors: CustomerValidationErrors = {}

  if (!customerName.trim()) {
    errors.customerName = 'El nombre del cliente es obligatorio.'
  }

  if (customerEmail.trim() && !isValidEmail(customerEmail.trim())) {
    errors.customerEmail = 'Ingresa un email valido.'
  }

  if (!Number.isFinite(validDays) || validDays < 1 || validDays > 365) {
    errors.validDays = 'La vigencia debe estar entre 1 y 365 dias.'
  }

  return errors
}

function validateItemFields({
  currentItem,
  pricingMode,
  customPrice,
}: {
  currentItem: {
    product_name: string
    weight_grams: number
    print_time_hours: number
    quantity: number
  }
  pricingMode: 'auto' | 'manual'
  customPrice: number
}): ItemValidationErrors {
  const errors: ItemValidationErrors = {}

  if (!currentItem.product_name.trim()) {
    errors.product_name = 'El nombre del producto es obligatorio.'
  }

  if (!Number.isFinite(currentItem.weight_grams) || currentItem.weight_grams <= 0) {
    errors.weight_grams = 'El peso debe ser mayor a 0.'
  }

  if (!Number.isFinite(currentItem.print_time_hours) || currentItem.print_time_hours <= 0) {
    errors.print_time_hours = 'El tiempo de impresion debe ser mayor a 0.'
  }

  if (!Number.isFinite(currentItem.quantity) || currentItem.quantity < 1) {
    errors.quantity = 'La cantidad debe ser al menos 1.'
  }

  if (pricingMode === 'manual' && (!Number.isFinite(customPrice) || customPrice <= 0)) {
    errors.customPrice = 'Define un precio unitario mayor a 0.'
  }

  return errors
}

function NewQuotePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToast } = useToast()
  const editMode = searchParams.get('edit')
  const templateIDFromQuery = searchParams.get('template_id')
  
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [templateNotice, setTemplateNotice] = useState<string | null>(null)
  const [customerErrors, setCustomerErrors] = useState<CustomerValidationErrors>({})
  const [itemErrors, setItemErrors] = useState<ItemValidationErrors>({})
  const [draftNotice, setDraftNotice] = useState<string | null>(null)
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null)

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
  const [templates, setTemplates] = useState<QuoteTemplate[]>([])
  const [selectedTemplateID, setSelectedTemplateID] = useState('')
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateID) || null,
    [templates, selectedTemplateID],
  )

  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
    setDraftTimestamp(null)
    setDraftNotice('Borrador local limpiado.')
  }, [])

  const applyTemplate = useCallback((template: QuoteTemplate) => {
    setSelectedTemplateID(template.id)
    setPricingMode('manual')
    setCustomPrice(getSuggestedTemplateUnitPrice(template))
    setCurrentItem((prev) => ({
      ...prev,
      product_name: prev.product_name || template.name,
      description: prev.description || getTemplateDescription(template),
      other_costs: prev.other_costs > 0 ? prev.other_costs : template.base_cost,
    }))
    setTemplateError(null)
    setTemplateNotice(`Plantilla aplicada: ${template.name}`)
    setItemErrors((prev) => ({ ...prev, customPrice: undefined }))
  }, [])

  const clearTemplateSelection = useCallback(() => {
    setSelectedTemplateID('')
    setTemplateNotice(null)
  }, [])

  const loadTemplates = useCallback(async () => {
    setTemplateError(null)

    try {
      setTemplatesLoading(true)
      const response = await apiClient.get<QuoteTemplatesResponse>('/quotes/templates')
      setTemplates(response.templates || [])
    } catch (error: unknown) {
      setTemplates([])
      setTemplateError(getErrorMessage(error, 'No se pudieron cargar plantillas'))
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  const loadQuoteForEdit = useCallback(async (quoteIdToEdit: string) => {
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
      addToast({
        title: 'Error cargando cotizacion',
        description: 'No se pudo cargar para edicion.',
        variant: 'error',
      })
      router.push('/dashboard/quotes')
    } finally {
      setLoading(false)
    }
  }, [addToast, router])

  // Load existing quote if in edit mode
  useEffect(() => {
    if (editMode) {
      loadQuoteForEdit(editMode)
    }
  }, [editMode, loadQuoteForEdit])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (templates.length === 0 || selectedTemplateID) {
      return
    }

    if (templateIDFromQuery) {
      const templateFromQuery = templates.find((template) => template.id === templateIDFromQuery)
      if (templateFromQuery) {
        applyTemplate(templateFromQuery)
      } else {
        setTemplateError('La plantilla seleccionada no existe o ya no esta disponible.')
      }
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    const rawStoredTemplate = window.sessionStorage.getItem('quote-template-selected')
    if (!rawStoredTemplate) {
      return
    }

    try {
      const parsed = JSON.parse(rawStoredTemplate) as { id?: string }
      if (!parsed.id) {
        return
      }
      const storedTemplate = templates.find((template) => template.id === parsed.id)
      if (storedTemplate) {
        applyTemplate(storedTemplate)
      }
    } catch {
      // Ignore malformed storage.
    } finally {
      window.sessionStorage.removeItem('quote-template-selected')
    }
  }, [applyTemplate, selectedTemplateID, templateIDFromQuery, templates])

  useEffect(() => {
    if (editMode || typeof window === 'undefined') {
      return
    }

    const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!rawDraft) {
      return
    }

    try {
      const parsed = JSON.parse(rawDraft) as Partial<QuoteDraft> & { savedAt?: string }

      setCustomerName(parsed.customerName || '')
      setCustomerEmail(parsed.customerEmail || '')
      setCustomerPhone(parsed.customerPhone || '')
      setNotes(parsed.notes || '')
      setValidDays(parsed.validDays && parsed.validDays > 0 ? parsed.validDays : 15)
      setItems(Array.isArray(parsed.items) ? parsed.items : [])
      setPricingMode(parsed.pricingMode === 'manual' ? 'manual' : 'auto')
      setCustomPrice(typeof parsed.customPrice === 'number' ? parsed.customPrice : 0)
      setCurrentItem({
        product_name: parsed.currentItem?.product_name || '',
        description: parsed.currentItem?.description || '',
        weight_grams: parsed.currentItem?.weight_grams || 0,
        print_time_hours: parsed.currentItem?.print_time_hours || 0,
        quantity: parsed.currentItem?.quantity || 1,
        other_costs: parsed.currentItem?.other_costs || 0,
      })

      if (!templateIDFromQuery) {
        setSelectedTemplateID(parsed.selectedTemplateID || '')
      }

      if (parsed.savedAt) {
        setDraftTimestamp(parsed.savedAt)
      }

      setDraftNotice('Se recupero un borrador local de cotizacion.')
    } catch {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  }, [editMode, templateIDFromQuery])

  useEffect(() => {
    if (isEditMode || quoteId || typeof window === 'undefined') {
      return
    }

    const hasContent =
      customerName.trim() !== '' ||
      customerEmail.trim() !== '' ||
      customerPhone.trim() !== '' ||
      notes.trim() !== '' ||
      items.length > 0 ||
      currentItem.product_name.trim() !== '' ||
      currentItem.description.trim() !== '' ||
      currentItem.weight_grams > 0 ||
      currentItem.print_time_hours > 0 ||
      currentItem.other_costs > 0 ||
      selectedTemplateID !== ''

    if (!hasContent) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
      setDraftTimestamp(null)
      return
    }

    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString()
      const draft: QuoteDraft & { savedAt: string } = {
        customerName,
        customerEmail,
        customerPhone,
        notes,
        validDays,
        items,
        pricingMode,
        customPrice,
        currentItem,
        selectedTemplateID,
        savedAt,
      }

      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
      setDraftTimestamp(savedAt)
    }, 500)

    return () => window.clearTimeout(timer)
  }, [
    currentItem,
    customerEmail,
    customerName,
    customerPhone,
    customPrice,
    isEditMode,
    items,
    notes,
    pricingMode,
    quoteId,
    selectedTemplateID,
    validDays,
  ])

  const updateQuote = async () => {
    const validation = validateCustomerFields({ customerName, customerEmail, validDays })
    setCustomerErrors(validation)
    if (Object.keys(validation).length > 0) {
      addToast({
        title: 'Corrige los datos del cliente',
        description: 'Revisa los campos marcados antes de continuar.',
        variant: 'warning',
      })
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

      addToast({
        title: 'Cliente actualizado',
        description: 'Los datos de la cotizacion fueron actualizados.',
        variant: 'success',
      })
    } catch (error: unknown) {
      console.error('Error updating quote:', error)
      addToast({
        title: 'Error al actualizar cotizacion',
        description: getErrorMessage(error, 'Error desconocido'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const createQuote = async () => {
    const validation = validateCustomerFields({ customerName, customerEmail, validDays })
    setCustomerErrors(validation)
    if (Object.keys(validation).length > 0) {
      addToast({
        title: 'Corrige los datos del cliente',
        description: 'Revisa los campos marcados antes de continuar.',
        variant: 'warning',
      })
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

      clearDraft()
      setQuoteId(response.id)
      setStep(2)
      addToast({
        title: 'Cotizacion creada',
        description: 'Ahora puedes agregar items y definir precios.',
        variant: 'success',
      })
    } catch (error: unknown) {
      console.error('Error creating quote:', error)
      const message = getErrorMessage(error, 'Error desconocido')

      if (message.includes('fetch') || message.includes('Failed to fetch')) {
        addToast({
          title: 'No hay conexion con backend',
          description: 'Inicia el API para poder crear cotizaciones.',
          variant: 'error',
        })
      } else {
        addToast({
          title: 'Error al crear cotizacion',
          description: message,
          variant: 'error',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const addItemToQuote = async (breakdown?: CostBreakdown) => {
    if (!quoteId) {
      addToast({
        title: 'Falta crear la cotizacion',
        description: 'Primero completa el paso 1.',
        variant: 'warning',
      })
      return
    }

    const validation = validateItemFields({ currentItem, pricingMode, customPrice })
    setItemErrors(validation)
    if (Object.keys(validation).length > 0) {
      addToast({
        title: 'Revisa los campos del item',
        description: 'Hay datos obligatorios o invalidos.',
        variant: 'warning',
      })
      return
    }

    try {
      setLoading(true)
      
      // Determinar precio basado en modo
      let finalUnitPrice = 0
      let finalTotal = 0

      if (pricingMode === 'manual') {
        if (customPrice <= 0) {
          setItemErrors((prev) => ({ ...prev, customPrice: 'Define un precio unitario mayor a 0.' }))
          return
        }
        finalUnitPrice = customPrice
        finalTotal = customPrice * currentItem.quantity
      } else {
        if (!breakdown) {
          addToast({
            title: 'Falta calcular precio',
            description: 'Usa la calculadora para obtener el costo automatico.',
            variant: 'warning',
          })
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
        other_costs: selectedTemplate ? selectedTemplate.base_cost : 0,
      })
      setCustomPrice(selectedTemplate ? getSuggestedTemplateUnitPrice(selectedTemplate) : 0)
      setItemErrors({})
      addToast({
        title: 'Item agregado',
        description: 'Se agrego correctamente a la cotizacion.',
        variant: 'success',
      })
    } catch (error: unknown) {
      console.error('Error adding item:', error)
      addToast({
        title: 'Error al agregar item',
        description: getErrorMessage(error, 'Error desconocido'),
        variant: 'error',
      })
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

        addToast({
          title: 'Item eliminado',
          description: 'Se elimino correctamente de la cotizacion.',
          variant: 'success',
        })
      } catch (error: unknown) {
        console.error('Error deleting item:', error)
        addToast({
          title: 'Error al eliminar item',
          description: getErrorMessage(error, 'Error desconocido'),
          variant: 'error',
        })
      } finally {
        setLoading(false)
      }
    } else {
      // En modo creación, solo eliminar del estado local
      setItems(items.filter((_, i) => i !== index))
      addToast({
        title: 'Item eliminado',
        description: 'Se elimino del borrador actual.',
        variant: 'default',
      })
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
    void removeItem(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    addToast({
      title: 'Item listo para editar',
      description: 'Actualiza sus datos y vuelve a agregarlo.',
      variant: 'default',
    })
  }

  const finishQuote = () => {
    if (items.length === 0) {
      addToast({
        title: 'Cotizacion incompleta',
        description: 'Agrega al menos un item antes de finalizar.',
        variant: 'warning',
      })
      return
    }
    clearDraft()
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
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-700 p-6 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{isEditMode ? 'Editar Cotizacion' : 'Nueva Cotizacion'}</h1>
            <p className="text-white/80 mt-2">
              {isEditMode
                ? 'Actualiza datos del cliente y administracion de items.'
                : 'Flujo guiado con plantilla, costos y cierre de cotizacion.'}
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm"
          >
            Volver
          </button>
        </div>
      </div>

      {!isEditMode && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="font-medium">Autoguardado activo</p>
            <p className="text-cyan-800">
              {draftTimestamp
                ? `Ultimo guardado: ${new Date(draftTimestamp).toLocaleTimeString('es-MX')}`
                : 'Empieza a escribir para guardar un borrador local.'}
            </p>
            {draftNotice && <p className="text-cyan-700 mt-1">{draftNotice}</p>}
          </div>
          <button onClick={clearDraft} className="px-3 py-2 rounded-lg border border-cyan-300 hover:bg-white">
            Limpiar borrador
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-center gap-4">
          <div className={`flex items-center ${step >= 1 ? 'text-cyan-700' : 'text-gray-400'}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                step >= 1 ? 'border-cyan-700 bg-cyan-50' : 'border-gray-300'
              }`}
            >
              1
            </div>
            <span className="ml-2 font-medium">Datos del Cliente</span>
          </div>
          <div className="w-16 h-0.5 bg-gray-300" />
          <div className={`flex items-center ${step >= 2 ? 'text-cyan-700' : 'text-gray-400'}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                step >= 2 ? 'border-cyan-700 bg-cyan-50' : 'border-gray-300'
              }`}
            >
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
                onChange={(e) => {
                  setCustomerName(e.target.value)
                  setCustomerErrors((prev) => ({ ...prev, customerName: undefined }))
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-black ${
                  customerErrors.customerName ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="Juan Pérez"
              />
              {customerErrors.customerName && (
                <p className="text-xs text-red-600 mt-1">{customerErrors.customerName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Email (opcional)
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => {
                  setCustomerEmail(e.target.value)
                  setCustomerErrors((prev) => ({ ...prev, customerEmail: undefined }))
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-black ${
                  customerErrors.customerEmail ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="juan@example.com"
              />
              {customerErrors.customerEmail && (
                <p className="text-xs text-red-600 mt-1">{customerErrors.customerEmail}</p>
              )}
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
                onChange={(e) => {
                  setValidDays(parseInt(e.target.value, 10) || 15)
                  setCustomerErrors((prev) => ({ ...prev, validDays: undefined }))
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-black ${
                  customerErrors.validDays ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="15"
              />
              {customerErrors.validDays && (
                <p className="text-xs text-red-600 mt-1">{customerErrors.validDays}</p>
              )}
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
          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Plantilla para esta cotizacion</h3>
                <p className="text-sm text-gray-600">
                  Aplica parametros de impresion y sugerencia de precio a nuevos items.
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard/quotes/templates')}
                className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
              >
                Administrar Plantillas
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <select
                value={selectedTemplateID}
                onChange={(event) => setSelectedTemplateID(event.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-black"
                disabled={templatesLoading}
              >
                <option value="">
                  {templatesLoading ? 'Cargando plantillas...' : 'Seleccionar plantilla'}
                </option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.material})
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const selected = templates.find((template) => template.id === selectedTemplateID)
                  if (selected) {
                    applyTemplate(selected)
                  }
                }}
                disabled={!selectedTemplateID || templatesLoading}
                className="px-4 py-2 rounded-lg bg-cyan-700 text-white hover:bg-cyan-800 disabled:opacity-50"
              >
                Aplicar Plantilla
              </button>
            </div>

            {templateError && (
              <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">
                {templateError}
              </div>
            )}
            {templateNotice && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">
                {templateNotice}
              </div>
            )}

            {selectedTemplate && (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-cyan-900">{selectedTemplate.name}</p>
                    <p className="text-sm text-cyan-800">
                      {selectedTemplate.material} | {selectedTemplate.infill_percentage}% infill | {selectedTemplate.layer_height}mm capa | {selectedTemplate.print_speed}mm/s
                    </p>
                    {selectedTemplate.description && (
                      <p className="text-sm text-cyan-900 mt-1">{selectedTemplate.description}</p>
                    )}
                  </div>
                  <div className="text-sm text-cyan-900">
                    <p>Costo base: {formatCurrency(selectedTemplate.base_cost)}</p>
                    <p>Margen: {selectedTemplate.markup_percentage}%</p>
                    <p className="font-semibold">
                      Precio sugerido: {formatCurrency(getSuggestedTemplateUnitPrice(selectedTemplate))}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setPricingMode('manual')
                      setCustomPrice(getSuggestedTemplateUnitPrice(selectedTemplate))
                      setItemErrors((prev) => ({ ...prev, customPrice: undefined }))
                    }}
                    className="px-3 py-2 rounded-lg bg-cyan-700 text-white text-sm hover:bg-cyan-800"
                  >
                    Usar precio sugerido
                  </button>
                  <button
                    onClick={clearTemplateSelection}
                    className="px-3 py-2 rounded-lg border text-sm hover:bg-white"
                  >
                    Quitar plantilla
                  </button>
                </div>
              </div>
            )}
          </div>

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
                  onChange={(e) => {
                    setCurrentItem({ ...currentItem, product_name: e.target.value })
                    setItemErrors((prev) => ({ ...prev, product_name: undefined }))
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-black ${
                    itemErrors.product_name ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="Ej: Maceta decorativa"
                />
                {itemErrors.product_name && <p className="text-xs text-red-600 mt-1">{itemErrors.product_name}</p>}
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
                  onChange={(e) => {
                    setCurrentItem({ ...currentItem, weight_grams: parseFloat(e.target.value) || 0 })
                    setItemErrors((prev) => ({ ...prev, weight_grams: undefined }))
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-black ${
                    itemErrors.weight_grams ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="100"
                />
                {itemErrors.weight_grams && <p className="text-xs text-red-600 mt-1">{itemErrors.weight_grams}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Tiempo de impresión (horas) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentItem.print_time_hours || ''}
                  onChange={(e) => {
                    setCurrentItem({ ...currentItem, print_time_hours: parseFloat(e.target.value) || 0 })
                    setItemErrors((prev) => ({ ...prev, print_time_hours: undefined }))
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-black ${
                    itemErrors.print_time_hours ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="5.5"
                />
                {itemErrors.print_time_hours && (
                  <p className="text-xs text-red-600 mt-1">{itemErrors.print_time_hours}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Cantidad *
                </label>
                <input
                  type="number"
                  value={currentItem.quantity || ''}
                  onChange={(e) => {
                    setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value, 10) || 1 })
                    setItemErrors((prev) => ({ ...prev, quantity: undefined }))
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-black ${
                    itemErrors.quantity ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="1"
                />
                {itemErrors.quantity && <p className="text-xs text-red-600 mt-1">{itemErrors.quantity}</p>}
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
                    setItemErrors((prev) => ({ ...prev, customPrice: undefined }))
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
                  onClick={() => {
                    setPricingMode('manual')
                    setItemErrors((prev) => ({ ...prev, customPrice: undefined }))
                  }}
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
                    const validation = validateItemFields({ currentItem, pricingMode, customPrice })
                    setItemErrors(validation)
                    if (Object.keys(validation).length === 0) {
                      addItemToQuote(breakdown)
                    } else {
                      addToast({
                        title: 'Datos incompletos del item',
                        description: 'Completa los campos requeridos para calcular.',
                        variant: 'warning',
                      })
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
                        onChange={(e) => {
                          setCustomPrice(parseFloat(e.target.value) || 0)
                          setItemErrors((prev) => ({ ...prev, customPrice: undefined }))
                        }}
                        className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-black ${
                          itemErrors.customPrice ? 'border-red-400' : 'border-gray-300'
                        }`}
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
                    {itemErrors.customPrice && <p className="text-xs text-red-600 mt-2">{itemErrors.customPrice}</p>}
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
