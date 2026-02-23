'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface PublicOrder {
  order_number: string;
  status: string;
  priority: string;
  customer_name: string;
  product_name: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

const statusInfo = {
  new: { label: 'Nueva', color: 'bg-blue-100 text-blue-800', icon: '📋', description: 'Tu pedido ha sido recibido' },
  printing: { label: 'En Impresión', color: 'bg-purple-100 text-purple-800', icon: '🖨️', description: 'Tu producto está siendo impreso' },
  post: { label: 'Post-proceso', color: 'bg-yellow-100 text-yellow-800', icon: '⚙️', description: 'Aplicando acabados finales' },
  packed: { label: 'Empacado', color: 'bg-orange-100 text-orange-800', icon: '📦', description: 'Tu pedido está empacado' },
  ready: { label: 'Listo', color: 'bg-green-100 text-green-800', icon: '✅', description: 'Listo para entrega' },
  delivered: { label: 'Entregado', color: 'bg-gray-100 text-gray-800', icon: '🎉', description: '¡Pedido entregado!' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: '❌', description: 'Pedido cancelado' },
};

export default function TrackOrderPage() {
  const params = useParams();
  const publicId = params.public_id as string;
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!publicId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api/v1'
    fetch(`${apiUrl}/public/orders/${publicId}`)
      .then(res => {
        if (!res.ok) throw new Error('Orden no encontrada');
        return res.json();
      })
      .then(data => {
        setOrder(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [publicId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Pedido no encontrado</h1>
          <p className="text-gray-600 mb-6">
            No pudimos encontrar información para este código de seguimiento.
            Por favor verifica el enlace e intenta nuevamente.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">Código: {publicId}</p>
          </div>
        </div>
      </div>
    );
  }

  const currentStatus = statusInfo[order.status as keyof typeof statusInfo] || statusInfo.new;
  const allStatuses = ['new', 'printing', 'post', 'packed', 'ready', 'delivered'];
  const currentIndex = allStatuses.indexOf(order.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            DOFER - Seguimiento de Pedido
          </h1>
          <p className="text-gray-600">Monitorea el estado de tu pedido en tiempo real</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{currentStatus.icon}</div>
            <span className={`inline-block px-6 py-2 rounded-full text-lg font-semibold ${currentStatus.color}`}>
              {currentStatus.label}
            </span>
            <p className="text-gray-600 mt-4 text-lg">{currentStatus.description}</p>
          </div>

          {/* Order Info */}
          <div className="border-t border-gray-200 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Número de Pedido</p>
                <p className="text-xl font-bold text-gray-800">{order.order_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Cliente</p>
                <p className="text-xl font-semibold text-gray-800">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Producto</p>
                <p className="text-lg text-gray-800">{order.product_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Cantidad</p>
                <p className="text-lg text-gray-800">{order.quantity} unidad(es)</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Fecha de Pedido</p>
                <p className="text-lg text-gray-800">
                  {new Date(order.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Última Actualización</p>
                <p className="text-lg text-gray-800">
                  {new Date(order.updated_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Progreso del Pedido</h2>
          
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gray-200"></div>
            <div 
              className="absolute left-8 top-0 w-1 bg-indigo-600 transition-all duration-500"
              style={{ height: `${(currentIndex / (allStatuses.length - 1)) * 100}%` }}
            ></div>

            {/* Timeline Steps */}
            <div className="space-y-8">
              {allStatuses.map((status, index) => {
                const statusData = statusInfo[status as keyof typeof statusInfo];
                const isPast = index <= currentIndex;
                const isCurrent = index === currentIndex;
                
                return (
                  <div key={status} className="relative flex items-start">
                    {/* Circle */}
                    <div className={`
                      relative z-10 flex items-center justify-center w-16 h-16 rounded-full border-4 
                      ${isPast ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}
                      ${isCurrent ? 'ring-4 ring-indigo-200' : ''}
                      transition-all duration-300
                    `}>
                      <span className="text-2xl">
                        {isPast ? '✓' : statusData.icon}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="ml-6 flex-1">
                      <h3 className={`text-xl font-semibold mb-1 ${isPast ? 'text-gray-800' : 'text-gray-400'}`}>
                        {statusData.label}
                      </h3>
                      <p className={`text-sm ${isPast ? 'text-gray-600' : 'text-gray-400'}`}>
                        {statusData.description}
                      </p>
                      {isCurrent && (
                        <span className="inline-block mt-2 px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                          Estado Actual
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600">
          <p className="text-sm">
            ¿Tienes preguntas sobre tu pedido?{' '}
            <a href="mailto:contacto@dofer.com" className="text-indigo-600 hover:underline">
              Contáctanos
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
