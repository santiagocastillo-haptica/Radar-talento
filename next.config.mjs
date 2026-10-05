/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'exceljs'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
