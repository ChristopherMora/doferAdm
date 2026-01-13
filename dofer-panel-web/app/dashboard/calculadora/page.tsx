'use client'

import CalculadoraCostos from '@/components/CalculadoraCostos'

export default function CalculadoraPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calculadora de Costos</h1>
        <p className="text-sm text-muted-foreground mt-1">Calcula precios de impresión 3D</p>
      </div>
      <CalculadoraCostos />
    </div>
  )
}
