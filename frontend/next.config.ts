import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.next/**",
          "**/backend/**",
          "**/.pytest_cache/**",
          "**/*.db*",
          "**/*.log*",
          "**/next-env.d.ts",
          "**/.agents/**",
          "**/.git/**",
          "**/.venv/**",
          "**/.vscode/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
