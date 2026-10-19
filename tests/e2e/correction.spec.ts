import { expect, test } from "@playwright/test";

/**
 * Correction d'un montant de bout en bout. Écrit de vraies données, UNIQUEMENT dans la
 * « Boutique de test automatique » du compte de test (sélectionnée dans Paramètres) ;
 * le client de test est soldé puis archivé à la fin.
 */
const { TEST_USER_EMAIL, TEST_USER_PASSWORD } = process.env;
const TEST_SHOP = "Boutique de test automatique";

test.skip(!TEST_USER_EMAIL || !TEST_USER_PASSWORD, "Identifiants de test absents (.env.test.local)");

test("dette saisie 800 au lieu de 900 : bouton Modifier, solde et historique corrects", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/login?next=/settings");
  await page.getByLabel("Adresse email").fill(TEST_USER_EMAIL!);
  await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_USER_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => u.pathname === "/settings");

  // Bascule sur la boutique de test (jamais la boutique réelle).
  const testShop = page.getByRole("listitem").filter({ hasText: TEST_SHOP });
  test.skip((await testShop.count()) === 0, `Pas de « ${TEST_SHOP} » (lancez d'abord npm run test:integration)`);
  const open = testShop.getByRole("button", { name: "Ouvrir" });
  if (await open.count()) {
    await open.click();
    await page.waitForURL((u) => u.pathname === "/dashboard");
  }
  await page.goto("/settings");
  await expect(page.getByRole("listitem").filter({ hasText: TEST_SHOP }).getByText("Boutique actuelle")).toBeVisible();

  // Client de test.
  const name = `TEST correction ${Date.now()}`;
  await page.goto("/customers/new");
  await page.getByLabel("Nom du client").fill(name);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}$/);
  const customerUrl = new URL(page.url()).pathname;

  // Dette saisie avec une erreur : 800 au lieu de 900.
  await page.getByRole("link", { name: "Ajouter une dette" }).click();
  await page.getByLabel("Montant (FCFA)").fill("800");
  await page.getByRole("button", { name: "Enregistrer la dette" }).click();
  await expect(page.getByText(/Dette de 800\sFCFA enregistrée/)).toBeVisible();

  // Correction depuis le message de confirmation.
  await page.getByRole("button", { name: "Erreur de montant ? Modifier" }).click();
  await page.getByLabel("Bon montant (FCFA)").fill("900");
  await page.getByRole("button", { name: "Enregistrer la correction" }).click();
  await expect(page.getByText(/Montant corrigé : 800\sFCFA → 900\sFCFA/)).toBeVisible();

  // Fiche client : solde 900, trace de la correction.
  await page.goto(customerUrl);
  await expect(page.getByText(/^900\sFCFA$/).first()).toBeVisible();
  await expect(page.getByText("Corrigée", { exact: true })).toBeVisible();
  await expect(page.getByText("Montant corrigé", { exact: true })).toBeVisible();
  await expect(page.getByText("Correction", { exact: true })).toBeVisible();

  // Nettoyage : solder puis archiver le client de test.
  await page.goto(`/repayments/new?customer=${customerUrl.split("/").pop()}`);
  await page.getByRole("button", { name: /^Tout/ }).click();
  await page.getByRole("button", { name: "Enregistrer le remboursement" }).click();
  await expect(page.getByText(/Nouveau solde : 0\sFCFA/)).toBeVisible();
  await page.goto(customerUrl);
  await page.getByRole("button", { name: "Archiver ce client" }).click();
  await page.waitForURL((u) => u.pathname === "/customers");
});
