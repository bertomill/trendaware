/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Increase serverless function timeout (helps with OpenAI API calls)
  serverRuntimeConfig: {
    maxDuration: 60, // 60 seconds timeout for API routes
  },
  
  // Configure redirects if needed
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: true,
      },
    ];
  },
  
  // Configure headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  
  // Configure image domains if you're using next/image
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  
  // Enable experimental features if needed
  experimental: {
    // Fix: serverActions should be an object or removed
    // serverActions: true,
  },
  
  // Configure webpack if needed
  webpack: (config, { isServer }) => {
    // Custom webpack config here if needed
    return config;
  },
};

module.exports = nextConfig; 