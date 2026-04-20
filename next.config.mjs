/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const origin = process.env.BASE_DOMAIN
      ? `https://*.${process.env.BASE_DOMAIN}`
      : '*'
    return [
      {
        source: '/api/signup',
        headers: [{ key: 'Access-Control-Allow-Origin', value: origin }],
      },
    ]
  },
}

export default nextConfig
