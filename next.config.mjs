/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/generate-designs": ["./public/lettering-styles/*.png"]
  }
};

export default nextConfig;
