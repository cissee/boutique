import { defineConfig } from "@playwright/test";

/**
 * Enregistrement des vidéos de démonstration (YouTube / CapCut), format vertical 1080x1920.
 * Lancement : npx playwright test --config playwright.video.config.ts
 * Les images sont capturées en pleine définition par record() (scripts/video/helpers.ts),
 * puis assemblées en MP4 (H.264, 30 i/s) dans VIDEO_OUT_DIR (par défaut : Vidéos\BoutikDekk).
 */
try {
  process.loadEnvFile(".env.demo.local");
} catch {
  // Sans compte de démonstration, seules les séquences publiques sont enregistrées.
}

const RAW_DIR = process.env.VIDEO_RAW_DIR ?? "video-raw";

export default defineConfig({
  testDir: "scripts/video",
  testMatch: /.*\.video\.ts/,
  timeout: 5 * 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  outputDir: RAW_DIR,
  use: {
    baseURL: process.env.VIDEO_BASE_URL ?? "https://boutique-tau-five.vercel.app",
    // 432x768 points x 2,5 = 1080x1920 pixels : image nette au format vertical.
    viewport: { width: 432, height: 768 },
    deviceScaleFactor: 2.5,
    isMobile: true,
    hasTouch: false,
    locale: "fr-FR",
    timezoneId: "Africa/Dakar",
    launchOptions: { slowMo: 60 },
  },
});
