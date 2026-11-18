/** @type {import('next').NextConfig} */

const nextConfig = {
  basePath: process.env.BASEPATH,

  redirects: async () => [
    { source: '/', destination: '/home', permanent: false, locale: false },
  ],
}

export default nextConfig
