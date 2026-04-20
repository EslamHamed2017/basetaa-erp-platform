import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    const origin = process.env.BASE_DOMAIN
      ? `https://*.${process.env.BASE_DOMAIN}`
      : '*'
    return [
      {
        // Only the public signup endpoint needs cross-origin access
        source: '/api/signup',
        headers: [{ key: 'Access-Control-Allow-Origin', value: origin }],
      },
    ]
  },
}

export default nextConfig
