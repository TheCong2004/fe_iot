/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tắt kiểm tra ESLint khi build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Tắt kiểm tra TypeScript khi build (cho phép dùng any)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
