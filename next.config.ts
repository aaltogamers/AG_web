import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (cfg, { isServer }) => {
    cfg.module.rules.push({
      test: /\.md$/,
      loader: 'frontmatter-markdown-loader',
      options: { mode: ['react-component'] },
    })
    if (isServer) {
      cfg.externals = cfg.externals || []
      if (Array.isArray(cfg.externals)) {
        cfg.externals.push(
          'pg',
          'pg-connection-string',
          'pg-pool',
          'pg-native',
          'node-pg-migrate',
          'path',
          'fs',
        )
      }
    }
    return cfg
  },
  output: 'standalone',
  // node-pg-migrate is loaded dynamically at runtime; make sure the standalone
  // output ships its dist/ and bin/ so migrations can run in the container.
  outputFileTracingIncludes: {
    '/api/analytics/**/*': ['./node_modules/node-pg-migrate/**/*'],
    '/api/db-health': ['./node_modules/node-pg-migrate/**/*'],
    '/api/tasks/**/*': ['./node_modules/node-pg-migrate/**/*'],
  },
  serverExternalPackages: ['node-pg-migrate', 'pg'],
  experimental: {
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
  async rewrites() {
    return {
      // Production only ships .webp versions of images (see copyPublicAndCompressImages.js),
      // but content and the CMS refer to the original paths. Fallback rewrites only
      // apply when no file matches, so locally the originals are still served.
      fallback: [
        {
          source: '/images/:path(.*)\\.:ext(png|PNG|jpg|JPG|jpeg|JPEG)',
          destination: '/images/:path.webp',
        },
      ],
    }
  },
}

export default nextConfig
