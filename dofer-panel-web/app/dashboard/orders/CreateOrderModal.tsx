'use client'

import { useState } from 'react'
import Image from 'next/image'
import { apiClient } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

interface CreateOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

 interface OrderFormErrors {
  customer_name?: string
  customer_email?: string
  product_name?: string
  quantity?: string
  delivery_deadline?: string
}

export default function CreateOrderModal({ isOpen, onClose, onSuccess }: CreateOrderModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<OrderFormErrors>({})
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [printFilePreview, setPrintFilePreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    platform: 'local',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    product_name: '',
    product_image: '',
    print_file: '',
    print_file_name: '',
    quantity: 1,
    priority: 'normal',
    notes: '',
    delivery_deadline: '',
  })

  const validateForm = (): OrderFormErrors => {
    const errors: OrderFormErrors = {}
    const trimmedCustomerName = formData.customer_name.trim()
    const trimmedProductName = formData.product_name.trim()
    const trimmedEmail = formData.customer_email.trim()

    if (!trimmedCustomerName) {
      errors.customer_name = 'El nombre del cliente es obligatorio.'
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.customer_email = 'Ingresa un email valido.'
    }

    if (!trimmedProductName) {
      errors.product_name = 'El producto es obligatorio.'
    }

    if (!Number.isFinite(formData.quantity) || formData.quantity < 1) {
      errors.quantity = 'La cantidad debe ser al menos 1.'
    }

    if (formData.delivery_deadline) {
      const deadline = new Date(formData.delivery_deadline)
      if (Number.isNaN(deadline.getTime())) {
        errors.delivery_deadline = 'Fecha de entrega invalida.'
      }
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validateForm()
    setFormErrors(validation)
    if (Object.keys(validation).length > 0) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('Creating order with data:', formData)
      const response = await apiClient.post('/orders', formData)
      console.log('Order created successfully:', response)
      onSuccess()
      onClose()
      // Reset form
      setFormData({
        platform: 'local',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        product_name: '',
        product_image: '',
        print_file: '',
        print_file_name: '',
        quantity: 1,
        priority: 'normal',
        notes: '',
        delivery_deadline: '',
      })
      setImagePreview(null)
      setPrintFilePreview(null)
    } catch (err: unknown) {
      console.error('Error creating order:', err)
      setError(getErrorMessage(err, 'Error al crear la orden'))
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormErrors((prev) => ({ ...prev, [name as keyof OrderFormErrors]: undefined }))
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 0 : value
    }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Convertir a base64 para preview y envío
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setImagePreview(base64)
        setFormData(prev => ({ ...prev, product_image: base64 }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePrintFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPrintFilePreview(file.name)
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setFormData(prev => ({ 
          ...prev, 
          print_file: base64,
          print_file_name: file.name
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-md">
      <div className="bg-slate-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-slate-600">
        <div className="p-6 border-b-2 border-slate-600 sticky top-0 bg-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-white">Nueva Orden</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl font-light"
              disabled={loading}
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-slate-850">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Platform */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Plataforma *
              </label>
              <select
                name="platform"
                value={formData.platform}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white"
              >
                <option value="local">Local</option>
                <option value="tiktok">TikTok</option>
                <option value="shopify">Shopify</option>
                <option value="other">Otro</option>
              </select>
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleChange}
                required
                placeholder="Juan Pérez"
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white placeholder:text-gray-400"
              />
              {formErrors.customer_name && (
                <p className="text-xs text-red-300 mt-1">{formErrors.customer_name}</p>
              )}
            </div>

            {/* Customer Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Email del Cliente
              </label>
              <input
                type="email"
                name="customer_email"
                value={formData.customer_email}
                onChange={handleChange}
                placeholder="cliente@example.com"
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white placeholder:text-gray-400"
              />
              {formErrors.customer_email && (
                <p className="text-xs text-red-300 mt-1">{formErrors.customer_email}</p>
              )}
            </div>

            {/* Customer Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Teléfono del Cliente
              </label>
              <input
                type="tel"
                name="customer_phone"
                value={formData.customer_phone}
                onChange={handleChange}
                placeholder="+52 123 456 7890"
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white placeholder:text-gray-400"
              />
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Producto *
              </label>
              <input
                type="text"
                name="product_name"
                value={formData.product_name}
                onChange={handleChange}
                required
                placeholder="Figura 3D Personalizada"
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white placeholder:text-gray-400"
              />
              {formErrors.product_name && (
                <p className="text-xs text-red-300 mt-1">{formErrors.product_name}</p>
              )}
            </div>

            {/* Product Image */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Imagen del Producto
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer"
              />
              {imagePreview && (
                <div className="mt-2">
                  <Image
                    src={imagePreview} 
                    alt="Preview" 
                    width={80}
                    height={80}
                    unoptimized
                    className="h-20 w-20 object-cover rounded-lg border border-slate-600"
                  />
                </div>
              )}
            </div>

            {/* Print File */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Archivo de Impresión (STL/3MF/GCODE)
              </label>
              <input
                type="file"
                accept=".stl,.3mf,.gcode,.gco"
                onChange={handlePrintFileChange}
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer"
              />
              {printFilePreview && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">{printFilePreview}</span>
                </div>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Cantidad *
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white"
              />
              {formErrors.quantity && (
                <p className="text-xs text-red-300 mt-1">{formErrors.quantity}</p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Prioridad *
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white"
              >
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            {/* Delivery Deadline */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                📅 Fecha de Entrega Máxima
              </label>
              <input
                type="datetime-local"
                name="delivery_deadline"
                value={formData.delivery_deadline}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white"
              />
              {formErrors.delivery_deadline && (
                <p className="text-xs text-red-300 mt-1">{formErrors.delivery_deadline}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">
              Notas
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Notas adicionales sobre la orden..."
              className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-700 text-white placeholder:text-gray-400"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-slate-600 text-gray-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold"
            >
              {loading ? 'Creando...' : 'Crear Orden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
