/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  compiler: { removeConsole: { exclude: ["error", "warn"] } },
  // These clients load generated JSON descriptors at runtime.
  serverExternalPackages: ["@google-cloud/kms", "@google-cloud/tasks"],
};

export default nextConfig;
