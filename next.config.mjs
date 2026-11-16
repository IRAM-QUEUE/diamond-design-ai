/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["fontkit", "bidi-js"],
  outputFileTracingIncludes: {
    "/api/generate-designs": ["./public/fonts/jewelry/*"],
    "/api/edit-design": ["./public/fonts/jewelry/*"]
  }
};

export default nextConfig;
