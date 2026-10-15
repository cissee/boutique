import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout dans un vrai navigateur, sur le build de production
 * (le service worker n'est actif qu'en production). Lancement : `npm run test:e2e`.
 *
 * PLAYWRIGHT_BASE_URL=http://localhost:3000 permet de viser un serveur déjà lancé
 * (ex. `npm run dev`) au lieu de démarrer le build de production.
 */
const PORT = 3200;
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

// Identifiants du compte de test (tests connectés), jamais versionnés.
try {
  process.loadEnvFile(".env.test.local");
} catch {
  // Fichier absent : les tests connectés seront ignorés.
}

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
