/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // SAMEORIGIN, not DENY. Chrome renders a PDF embedded via <object>
          // in a child frame, so DENY blocked the task brief on the candidate's
          // own task page and it fell through to "your browser can't show the
          // PDF inline". SAMEORIGIN still refuses every cross-origin framer,
          // which is the clickjacking case this header exists for.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // The modern equivalent, and the one browsers prefer where both are
          // present. Only frame-ancestors is set: naming no other directive
          // leaves scripts, styles and the rest unrestricted.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
};
export default nextConfig;
