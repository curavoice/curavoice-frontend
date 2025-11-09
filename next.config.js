/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  images: {
    remotePatterns: [],
  },

  async headers() {
    // Get API URL from environment variable or use defaults
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://curavoice-backend-production-3ea1.up.railway.app'
    
    // Build connect-src directive for CSP
    // Allow self, localhost for dev, and Railway backend for production
    const connectSrc = [
      "'self'",
      'ws://localhost:8000',
      'http://localhost:8000',
      'https://curavoice-backend-production-3ea1.up.railway.app',
      'https://*.up.railway.app', // Allow any Railway backend
    ].join(' ')

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src ${connectSrc}`
          }
        ]
      }
    ]
  },
}

module.exports = nextConfig


