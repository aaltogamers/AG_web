import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (cfg) => {
    cfg.module.rules.push({
      test: /\.md$/,
      loader: 'frontmatter-markdown-loader',
      options: { mode: ['react-component'] },
    })
    return cfg
  },
  output: 'standalone',
  // node-pg-migrate is loaded dynamically at runtime; make sure the standalone
  // output ships its dist/ and bin/ so migrations can run in the container.
  outputFileTracingIncludes: {
    '/api/analytics/**/*': ['./node_modules/node-pg-migrate/**/*'],
    '/api/db-health': ['./node_modules/node-pg-migrate/**/*'],
  },
  experimental: {
    // Enables Node.js runtime for middleware so we can use `pg` directly
    // (avoiding the Edge runtime's lack of Node APIs / self-fetch round trip).
    // Cast: the flag works at runtime but isn't yet in Next.js' typed config.
    nodeMiddleware: true,
  } as NextConfig['experimental'],
  async redirects() {
    return [
      {
        source: '/cms',
        destination: '/cms/index.html',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
