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
