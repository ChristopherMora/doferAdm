'use client'

import CalculadoraCostos from '@/components/CalculadoraCostos'

export default function CalculadoraPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow p-8">
        <CalculadoraCostos />
      </div>
    </div>
  )
}
