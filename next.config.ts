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
