import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout dans un vrai navigateur, sur le build de production
 * (le service worker n'est actif qu'en production). Lancement : `npm run test:e2e`.
 */
const PORT = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
