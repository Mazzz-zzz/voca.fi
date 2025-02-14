const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

module.exports = {
  // required to have several apps on single route
  publicRuntimeConfig: {
    basePath: basePath
  },
  basePath,
  trailingSlash: false,
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    minimumCacheTTL: 300,
  },
  async headers() {
    return [
      {
        source: '/voice',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'microphone=self'
          }
        ]
      }
    ]
  }
};
