import { expect, test } from "@playwright/test";

/** Formulaires publics : afficher / masquer le mot de passe. */
test("inscription : l'œil affiche puis masque chaque mot de passe", async ({ page }) => {
  await page.goto("/signup");
  const password = page.getByLabel("Mot de passe", { exact: true });
  const confirm = page.getByLabel("Confirmer le mot de passe");
  await password.fill("motdepasse1");
  await confirm.fill("motdepasse1");
  await expect(password).toHaveAttribute("type", "password");

  const toggles = page.getByRole("button", { name: "Afficher le mot de passe" });
  await expect(toggles).toHaveCount(2);

  await toggles.first().click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("motdepasse1");
  await expect(confirm).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Masquer le mot de passe" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("connexion : l'œil est disponible", async ({ page }) => {
  await page.goto("/login");
  const password = page.getByLabel("Mot de passe", { exact: true });
  await password.fill("secret123");
  await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
  await expect(password).toHaveAttribute("type", "text");
});
