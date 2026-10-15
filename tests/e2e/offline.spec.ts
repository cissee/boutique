import { expect, test, type Page } from "@playwright/test";

/**
 * Mode hors ligne dans un vrai navigateur (Chromium, profil mobile) :
 * service worker, page /offline servie sans réseau, file d'attente durable (IndexedDB).
 * La synchronisation vers Supabase est couverte par tests/db/offline-sync.test.ts.
 */

const SNAPSHOT = {
  userId: "00000000-0000-4000-8000-000000000001",
  shopId: "00000000-0000-4000-8000-000000000002",
  shopName: "Boutique Chez Modou",
  savedAt: "2026-10-15T09:00:00.000Z",
  customers: [
    { id: "00000000-0000-4000-8000-0000000000a1", name: "Ndèye Fatou Diop", phone: "+221771234567", balance: 12500 },
    { id: "00000000-0000-4000-8000-0000000000a2", name: "Mamadou Sall", phone: null, balance: 0 },
  ],
};

/** Attend que le service worker contrôle la page (premier chargement + rechargement). */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // Le cache de /offline est rempli à l'installation : on attend qu'il soit présent.
  await expect
    .poll(() => page.evaluate(async () => Boolean(await caches.match("/offline"))), { timeout: 15_000 })
    .toBe(true);
}

/** Écrit un instantané de clients dans IndexedDB, comme le ferait une visite en ligne. */
async function seedSnapshot(page: Page) {
  await page.evaluate(async (snapshot) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("boutikdekk-offline", 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore("operations", { keyPath: "requestId" });
        open.result.createObjectStore("meta");
      };
      open.onsuccess = () => {
        const tx = open.result.transaction("meta", "readwrite");
        tx.objectStore("meta").put(snapshot, "customerSnapshot");
        tx.oncomplete = () => {
          open.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, SNAPSHOT);
}

test("sans réseau : l'application s'ouvre, affiche les soldes et garde les saisies", async ({ page, context }) => {
  await page.goto("/offline");
  await waitForServiceWorker(page);
  await seedSnapshot(page);

  // --- Coupure réseau : n'importe quelle page sert /offline depuis le cache. ---
  await context.setOffline(true);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Mode hors ligne" })).toBeVisible();
  await expect(page.getByText("Boutique Chez Modou")).toBeVisible();

  // Recherche sans accent dans les soldes du dernier chargement.
  await page.getByRole("searchbox").fill("ndeye");
  await expect(page.getByText("Mamadou Sall")).toBeHidden();
  await page.getByRole("button", { name: /Ndèye Fatou Diop/ }).click();

  // Un remboursement supérieur au solde connu est bloqué.
  await page.getByRole("button", { name: "Remboursement", exact: true }).click();
  await page.getByLabel("Montant versé (FCFA)").fill("20000");
  await expect(page.getByRole("button", { name: "Enregistrer hors ligne" })).toBeDisabled();

  // Une dette est enregistrée sur le téléphone.
  await page.getByRole("button", { name: "Dette", exact: true }).click();
  await page.getByLabel("Montant (FCFA)").fill("1500");
  await page.getByRole("textbox", { name: /Description/ }).fill("Sucre");
  await page.getByRole("button", { name: "Enregistrer hors ligne" }).click();

  await expect(page.getByText("Enregistré sur le téléphone")).toBeVisible();
  const queue = page.locator("section", { has: page.getByRole("heading", { name: "Opérations hors ligne" }) });
  await expect(queue.getByText("Dette · Ndèye Fatou Diop")).toBeVisible();
  await expect(queue.getByText("En attente d'envoi")).toBeVisible();
  // Solde affiché = dernier solde connu + opérations en attente.
  await expect(page.getByText(/dont 1\s500\sFCFA en attente/)).toBeVisible();

  // --- L'application est fermée puis rouverte, toujours sans réseau : rien n'est perdu. ---
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mode hors ligne" })).toBeVisible();
  await expect(queue.getByText("Dette · Ndèye Fatou Diop")).toBeVisible();

  const stored = await page.evaluate(
    () =>
      new Promise<{ kind: string; amount: number; status: string; requestId: string }[]>((resolve, reject) => {
        const open = indexedDB.open("boutikdekk-offline", 1);
        open.onsuccess = () => {
          const req = open.result.transaction("operations").objectStore("operations").getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        };
      }),
  );
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ kind: "DEBT", amount: 1500, status: "pending" });
  expect(stored[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
});

test("aucune donnée personnelle dans le cache du service worker", async ({ page }) => {
  await page.goto("/offline");
  await waitForServiceWorker(page);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(new URL(request.url).pathname);
    }
    return urls;
  });
  expect(cached).toContain("/offline");
  const allowed = (path: string) =>
    ["/offline", "/manifest.webmanifest", "/icon.svg"].includes(path) ||
    path.startsWith("/_next/static/") ||
    path.startsWith("/icons/");
  const unexpected = cached.filter((path) => !allowed(path));
  expect(unexpected).toEqual([]);
});
