import type { MetadataRoute } from 'next'

// En iPadOS el Fullscreen API no es confiable, así que la pantalla completa
// real del modo caja se consigue instalando el panel desde "Añadir a pantalla
// de inicio": en standalone desaparece la barra de Safari y con ella el gesto
// que sacaba de la venta a media jornada.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DOFER Panel',
    short_name: 'DOFER',
    description: 'Punto de venta y gestión operativa DOFER',
    start_url: '/dashboard/bazar',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    icons: [
      { src: '/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
