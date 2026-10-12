import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/** Tests d'intégration contre un vrai projet Supabase (lit .env.local et .env.test.local). */
export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 30_000,
  },
}));
