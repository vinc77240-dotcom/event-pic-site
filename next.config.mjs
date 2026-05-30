/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/choisir-template",
        destination: "/choisir-mon-design",
        permanent: true
      },
      {
        source: "/choisir-template/:path*",
        destination: "/choisir-mon-design",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
