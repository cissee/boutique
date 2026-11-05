import { test } from "@playwright/test";
import { pause, record, scrollSmooth, showTouches, tap, typeSlow } from "./helpers";

test("01-presentation-et-inscription", async ({ page }) => {
  await showTouches(page);
  await page.goto("/");
  await page.getByRole("heading", { name: "BoutikDëkk" }).waitFor();
  await record(page, "01-presentation-et-inscription", async () => {
  await pause(page, 3500);

  await tap(page, page.getByRole("link", { name: "Créer mon compte" }), 1200);
  await typeSlow(page, page.getByLabel("Votre nom"), "Modou Diop");
  await typeSlow(page, page.getByLabel("Adresse email"), "modou@exemple.sn");
  await typeSlow(page, page.getByLabel("Mot de passe", { exact: true }), "boutique2026");
  await typeSlow(page, page.getByLabel("Confirmer le mot de passe"), "boutique2026");
  await tap(page, page.getByRole("button", { name: "Afficher le mot de passe" }).first(), 1500);
  await scrollSmooth(page, 300);
  await pause(page, 2000);
  });
});
