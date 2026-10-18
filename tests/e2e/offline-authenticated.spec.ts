import { expect, test, type Page } from "@playwright/test";

/**
 * Hors ligne avec un vrai compte : les écrans habituels (onglets, formulaire « Ajouter
 * une dette ») doivent basculer sur le mode hors ligne au lieu de rester bloqués.
 * Aucune donnée n'est écrite en base : l'opération mise en file est supprimée du
 * téléphone avant le retour du réseau.
 */
const { TEST_USER_EMAIL, TEST_USER_PASSWORD } = process.env;

test.skip(!TEST_USER_EMAIL || !TEST_USER_PASSWORD, "Identifiants de test absents (.env.test.local)");

const countQueued = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("boutikdekk-offline", 1);
        open.onsuccess = () => {
          const req = open.result.transaction("operations").objectStore("operations").count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        };
      }),
  );

const clearQueue = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open("boutikdekk-offline", 1);
        open.onsuccess = () => {
          const tx = open.result.transaction("operations", "readwrite");
          tx.objectStore("operations").clear();
          tx.oncomplete = () => resolve();
        };
      }),
  );

test("sans réseau, les écrans habituels basculent sur le mode hors ligne", async ({ page, context }) => {
  await page.goto("/login?next=/dashboard");
  await page.getByLabel("Adresse email").fill(TEST_USER_EMAIL!);
  await page.getByLabel("Mot de passe").fill(TEST_USER_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard");
  await expect(page.getByText("Total des dettes")).toBeVisible();
  await expect.poll(() => page.evaluate(async () => Boolean(await caches.match("/offline"))), { timeout: 15_000 }).toBe(true);

  // 1. Onglet « Clients » sans réseau : mode hors ligne, pas d'écran bloqué.
  await context.setOffline(true);
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Clients" }).click();
  await expect(page.getByRole("heading", { name: "Mode hors ligne" })).toBeVisible();

  // 2. Formulaire normal « Ajouter une dette » ouvert en ligne, envoyé sans réseau.
  await context.setOffline(false);
  await page.goto("/debts/new");
  await expect(page.getByRole("heading", { name: "Ajouter une dette" })).toBeVisible();
  const customer = page.locator("ul button").first();
  test.skip((await customer.count()) === 0, "Le compte de test n'a aucun client");
  await customer.click();
  await page.getByLabel("Montant (FCFA)").fill("100");

  await context.setOffline(true);
  await page.getByRole("button", { name: "Enregistrer la dette" }).click();
  await expect(page.getByText("Enregistré sur le téléphone")).toBeVisible();
  expect(await countQueued(page)).toBe(1);
  // Le formulaire est vidé pour la saisie suivante.
  await expect(page.getByLabel("Montant (FCFA)")).toHaveValue("");

  // Nettoyage AVANT le retour du réseau : rien ne part vers la base.
  await clearQueue(page);
  expect(await countQueued(page)).toBe(0);
});
