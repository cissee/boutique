import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";

const RAW_DIR = path.resolve(process.env.VIDEO_RAW_DIR ?? "video-raw");
const OUT_DIR = path.resolve(process.env.VIDEO_OUT_DIR ?? path.join(process.env.USERPROFILE ?? ".", "Videos", "BoutikDekk"));

/**
 * Enregistre `scenario` en MP4 1080x1920. Le screencast et les vidéos de Playwright capturent
 * en pixels « logiques » (432x768, flou une fois agrandi) : on prend donc des captures d'écran
 * en continu avec un facteur d'échelle de 2,5 (≈ 14 images/s, image nette). Chaque image est
 * gardée jusqu'à la suivante, puis ffmpeg produit une vidéo à cadence fixe (30 i/s) pour CapCut.
 */
export async function record(page: Page, name: string, scenario: () => Promise<void>) {
  const frameDir = path.join(RAW_DIR, name);
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const viewport = page.viewportSize() ?? { width: 432, height: 768 };
  const clip = { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1080 / viewport.width };
  const cdp = await page.context().newCDPSession(page);
  const frames: { file: string; ts: number }[] = [];
  let recording = true;

  const capture = (async () => {
    while (recording) {
      try {
        const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90, optimizeForSpeed: true, clip });
        const file = path.join(frameDir, `${String(frames.length).padStart(6, "0")}.jpg`);
        writeFileSync(file, Buffer.from(shot.data, "base64"));
        frames.push({ file, ts: Date.now() / 1000 });
      } catch {
        // Page en cours de navigation : on réessaie juste après.
        await new Promise((r) => setTimeout(r, 30));
      }
    }
  })();

  try {
    await scenario();
    await page.waitForTimeout(1200);
  } finally {
    recording = false;
    await capture;
  }
  if (!frames.length) throw new Error(`Aucune image capturée pour ${name}`);

  // Liste ffmpeg « concat » : chaque image dure jusqu'à la suivante ; la dernière, 1,5 s.
  const toPosix = (p: string) => p.split(path.sep).join("/");
  const lines: string[] = [];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.ts ?? f.ts + 1.5;
    lines.push(`file '${toPosix(f.file)}'`, `duration ${Math.max(0.01, next - f.ts).toFixed(3)}`);
  });
  lines.push(`file '${toPosix(frames[frames.length - 1].file)}'`);
  const list = path.join(frameDir, "frames.txt");
  writeFileSync(list, lines.join("\n"));

  const out = path.join(OUT_DIR, `${name}.mp4`);
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0xf5f6f4,fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", out,
  ]);
  return out;
}

/** Pause « humaine » entre deux gestes (laisse le temps au spectateur de lire). */
export const pause = (page: Page, ms = 900) => page.waitForTimeout(ms);

/**
 * Affiche un cercle à chaque toucher, pour que le spectateur voie où l'on appuie.
 * À appeler avant la première navigation.
 */
export async function showTouches(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `
      .demo-touch { position: fixed; z-index: 2147483647; pointer-events: none; width: 44px; height: 44px;
        margin: -22px 0 0 -22px; border-radius: 50%; background: rgba(245,184,61,.55);
        border: 3px solid rgba(245,184,61,.95); animation: demo-touch .6s ease-out forwards; }
      @keyframes demo-touch { from { transform: scale(.4); opacity: 1 } to { transform: scale(1.3); opacity: 0 } }`;
    const add = () => document.head && document.head.appendChild(style);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add);
    else add();
    window.addEventListener(
      "pointerdown",
      (e) => {
        const dot = document.createElement("div");
        dot.className = "demo-touch";
        dot.style.left = `${e.clientX}px`;
        dot.style.top = `${e.clientY}px`;
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 700);
      },
      true,
    );
  });
}

/** Touche un élément : déplacement de la souris, petite attente, puis clic (le cercle apparaît). */
export async function tap(page: Page, target: Locator, after = 700) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.waitForTimeout(250);
  await target.click();
  await page.waitForTimeout(after);
}

/** Saisie lettre par lettre, comme au clavier du téléphone. */
export async function typeSlow(page: Page, target: Locator, text: string, delay = 85) {
  await tap(page, target, 200);
  await target.pressSequentially(text, { delay });
  await page.waitForTimeout(400);
}

/** Défilement doux (le spectateur suit le mouvement). */
export async function scrollSmooth(page: Page, pixels: number, steps = 12) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, pixels / steps);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(500);
}
