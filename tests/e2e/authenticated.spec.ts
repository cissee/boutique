import { expect, test } from "@playwright/test";

/**
 * Parcours connecté en lecture seule : chaque page de l'application s'affiche sans
 * l'écran d'erreur. Nécessite TEST_USER_EMAIL / TEST_USER_PASSWORD (.env.test.local)
 * d'un compte confirmé ayant une boutique. Aucune donnée n'est créée.
 */
const { TEST_USER_EMAIL, TEST_USER_PASSWORD } = process.env;

test.skip(!TEST_USER_EMAIL || !TEST_USER_PASSWORD, "Identifiants de test absents (.env.test.local)");

const PAGES: { path: string; heading: RegExp }[] = [
  { path: "/customers", heading: /^Clients$/ },
  { path: "/customers/new", heading: /^Nouveau client$/ },
  { path: "/debts/new", heading: /^Ajouter une dette$/ },
  { path: "/repayments/new", heading: /^Remboursement$/ },
  { path: "/history", heading: /^Historique$/ },
  { path: "/reports", heading: /^Rapports$/ },
  { path: "/settings", heading: /^Paramètres$/ },
  { path: "/more", heading: /^Plus$/ },
];

test("connexion puis affichage de toutes les pages", async ({ page }) => {
  await page.goto("/login?next=/dashboard");
  await page.getByLabel("Adresse email").fill(TEST_USER_EMAIL!);
  await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_USER_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await page.waitForURL((url) => url.pathname === "/dashboard");
  await expect(page.getByText("Total des dettes")).toBeVisible();
  await expect(page.getByText("Cette page n'a pas pu s'afficher")).toHaveCount(0);

  for (const { path, heading } of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading }), path).toBeVisible();
    await expect(page.getByText("Cette page n'a pas pu s'afficher"), path).toHaveCount(0);
  }

  // Fiche du premier client, s'il y en a un.
  await page.goto("/customers");
  const firstCustomer = page.locator('a[href^="/customers/"]:not([href="/customers/new"])').first();
  if (await firstCustomer.count()) {
    await firstCustomer.click();
    await expect(page.getByText("Solde", { exact: true })).toBeVisible();
    await expect(page.getByText("Cette page n'a pas pu s'afficher")).toHaveCount(0);
  }

  // Navigation côté client (sans rechargement), comme un utilisateur qui touche les onglets.
  await page.goto("/dashboard");
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Clients" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^Clients$/ })).toBeVisible();
});
