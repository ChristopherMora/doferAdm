import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Modo standalone para Docker (genera build auto-contenido)
  output: 'standalone',

  // Optimizar imágenes
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Optimizaciones experimentales
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  
  // Configuración de compilación
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
};

export default nextConfig;
