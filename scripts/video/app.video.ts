import { expect, test, type Page } from "@playwright/test";
import { pause, record, scrollSmooth, showTouches, tap, typeSlow } from "./helpers";

/**
 * Séquences vidéo de l'application, avec le compte de démonstration (.env.demo.local)
 * rempli par scripts/video/seed-demo.mjs. Chaque séquence produit un MP4 1080x1920.
 * La connexion se fait hors caméra.
 */
const { DEMO_USER_EMAIL, DEMO_USER_PASSWORD } = process.env;
test.skip(!DEMO_USER_EMAIL || !DEMO_USER_PASSWORD, "Compte de démonstration absent (.env.demo.local)");
test.describe.configure({ mode: "serial" });

async function login(page: Page, next = "/dashboard") {
  await showTouches(page);
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Adresse email").fill(DEMO_USER_EMAIL!);
  await page.getByLabel("Mot de passe", { exact: true }).fill(DEMO_USER_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => u.pathname === next.split("?")[0]);
  await page.waitForLoadState("networkidle");
}

const nav = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name });

test("02-tableau-de-bord", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Total des dettes")).toBeVisible();
  await record(page, "02-tableau-de-bord", async () => {
    await pause(page, 3500);
    await scrollSmooth(page, 380);
    await pause(page, 2500);
    await scrollSmooth(page, 420);
    await pause(page, 3000);
    await scrollSmooth(page, -800);
    await pause(page, 1500);
  });
});

test("03-ajouter-un-client", async ({ page }) => {
  await login(page);
  await record(page, "03-ajouter-un-client", async () => {
    await pause(page, 1200);
    await tap(page, nav(page, "Clients"), 1800);
    await tap(page, page.getByRole("link", { name: "Nouveau client" }), 1200);
    await typeSlow(page, page.getByLabel("Nom du client"), "Ousmane Diallo");
    await typeSlow(page, page.getByLabel(/^Téléphone/), "77 000 00 08");
    await typeSlow(page, page.getByLabel(/^Notes/), "Voisin du marché");
    await tap(page, page.getByRole("button", { name: "Enregistrer" }), 2500);
    await expect(page.getByRole("heading", { level: 1, name: "Ousmane Diallo" })).toBeVisible();
    await pause(page, 2500);
  });
});

test("04-ajouter-une-dette", async ({ page }) => {
  await login(page);
  await record(page, "04-ajouter-une-dette", async () => {
    await pause(page, 1200);
    await tap(page, page.getByRole("link", { name: "Ajouter une dette" }).last(), 1500);
    await typeSlow(page, page.getByRole("searchbox"), "fatou");
    await tap(page, page.getByRole("button", { name: /Fatou Diop/ }), 1200);
    await tap(page, page.getByRole("button", { name: /^2\s000$/ }), 900);
    await typeSlow(page, page.getByLabel(/^Description/), "Riz 2 kg et oignons");
    await tap(page, page.getByRole("button", { name: "Enregistrer la dette" }), 2500);
    await expect(page.getByText(/Dette de 2\s000\sFCFA enregistrée/)).toBeVisible();
    await pause(page, 3500);
  });
});

test("05-corriger-un-montant", async ({ page }) => {
  await login(page);
  await record(page, "05-corriger-un-montant", async () => {
    await pause(page, 1000);
    await tap(page, page.getByRole("link", { name: "Ajouter une dette" }).last(), 1500);
    await typeSlow(page, page.getByRole("searchbox"), "khady");
    await tap(page, page.getByRole("button", { name: /Khady Sow/ }), 1000);
    await typeSlow(page, page.getByLabel("Montant (FCFA)"), "800", 180);
    await tap(page, page.getByRole("button", { name: "Enregistrer la dette" }), 2500);
    await pause(page, 1500);
    await tap(page, page.getByRole("button", { name: "Erreur de montant ? Modifier" }), 1200);
    await typeSlow(page, page.getByLabel("Bon montant (FCFA)"), "900", 180);
    await tap(page, page.getByRole("button", { name: "Enregistrer la correction" }), 2500);
    await expect(page.getByText(/Montant corrigé : 800\sFCFA → 900\sFCFA/)).toBeVisible();
    await pause(page, 3000);
    await tap(page, page.getByRole("link", { name: "Voir la fiche du client" }), 2000);
    await scrollSmooth(page, 650);
    await pause(page, 3500);
  });
});

test("06-remboursement-et-recu", async ({ page }) => {
  await login(page);
  await record(page, "06-remboursement-et-recu", async () => {
    await pause(page, 1000);
    await tap(page, nav(page, "Remboursements"), 1500);
    await typeSlow(page, page.getByRole("searchbox"), "awa");
    await tap(page, page.getByRole("button", { name: /Awa Ndiaye/ }), 1200);
    await typeSlow(page, page.getByLabel("Montant versé (FCFA)"), "5000", 160);
    await pause(page, 1500);
    await tap(page, page.getByRole("button", { name: "Wave", exact: true }), 1000);
    await scrollSmooth(page, 300);
    await tap(page, page.getByRole("button", { name: "Enregistrer le remboursement" }), 2500);
    await expect(page.getByText(/Remboursement de 5\s000\sFCFA enregistré/)).toBeVisible();
    await scrollSmooth(page, -400);
    await pause(page, 3000);
    // On montre les boutons du reçu sans ouvrir WhatsApp.
    const whatsapp = page.getByRole("link", { name: /WhatsApp/ }).first();
    const box = await whatsapp.boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
    await pause(page, 3500);
  });
});

test("07-fiche-client", async ({ page }) => {
  await login(page);
  await record(page, "07-fiche-client", async () => {
    await pause(page, 1000);
    await tap(page, nav(page, "Clients"), 1500);
    await typeSlow(page, page.getByRole("searchbox"), "ibra");
    await pause(page, 1000);
    await tap(page, page.getByRole("link", { name: /Ibrahima Sarr/ }), 2000);
    await pause(page, 2500);
    await scrollSmooth(page, 450);
    await pause(page, 2500);
    await scrollSmooth(page, 450);
    await pause(page, 3000);
  });
});

test("08-historique", async ({ page }) => {
  await login(page, "/more");
  await record(page, "08-historique", async () => {
    await pause(page, 1000);
    await tap(page, page.getByRole("link", { name: "Historique" }), 2000);
    await pause(page, 1500);
    await tap(page, page.getByRole("link", { name: "7 jours" }), 2000);
    await tap(page, page.getByText("Filtres", { exact: true }), 1000);
    await page.getByRole("combobox").selectOption("REPAYMENT");
    await pause(page, 1000);
    await tap(page, page.getByRole("button", { name: "Filtrer" }), 2500);
    await scrollSmooth(page, 400);
    await pause(page, 3000);
  });
});

test("09-rapports", async ({ page }) => {
  await login(page, "/more");
  await record(page, "09-rapports", async () => {
    await pause(page, 1000);
    await tap(page, page.getByRole("link", { name: "Rapports" }), 2500);
    await pause(page, 2500);
    await scrollSmooth(page, 450);
    await pause(page, 2500);
    await scrollSmooth(page, 500);
    await pause(page, 3000);
  });
});

test("10-inviter-un-vendeur", async ({ page }) => {
  await login(page, "/settings");
  const team = page.getByRole("heading", { level: 2, name: "Équipe" });
  await expect(team).toBeVisible();
  await record(page, "10-inviter-un-vendeur", async () => {
    await pause(page, 1500);
    await team.scrollIntoViewIfNeeded();
    await scrollSmooth(page, 120);
    await pause(page, 2500);
    await tap(page, page.getByRole("button", { name: "Inviter un vendeur" }), 2000);
    await page.getByRole("link", { name: /Envoyer par WhatsApp/ }).scrollIntoViewIfNeeded();
    await scrollSmooth(page, 120);
    await pause(page, 4500);
  });
  // Ménage : on révoque les invitations créées pour la vidéo.
  for (const revoke of await page.getByRole("button", { name: "Révoquer" }).all()) await revoke.click();
});

test("11-mode-hors-ligne", async ({ page, context }) => {
  await login(page);
  await expect(page.getByText("Total des dettes")).toBeVisible();
  // Laisse le service worker et la copie locale des clients se mettre en place.
  await page.waitForTimeout(5000);
  await record(page, "11-mode-hors-ligne", async () => {
    await pause(page, 1500);
    // Coupure d'Internet : « + Dette » ouvre le mode hors ligne.
    await context.setOffline(true);
    await pause(page, 1500);
    await tap(page, page.getByRole("link", { name: "Ajouter une dette" }).last(), 2500);
    await expect(page.getByRole("heading", { name: "Mode hors ligne" })).toBeVisible();
    await pause(page, 2500);
    await typeSlow(page, page.getByRole("searchbox"), "cheikh");
    await tap(page, page.getByRole("button", { name: /Cheikh Ndour/ }), 1200);
    await typeSlow(page, page.getByLabel("Montant (FCFA)"), "1000", 160);
    await typeSlow(page, page.getByRole("textbox", { name: /Description/ }), "Pain");
    await tap(page, page.getByRole("button", { name: "Enregistrer hors ligne" }), 2000);
    await expect(page.getByText("Enregistré sur le téléphone")).toBeVisible();
    await expect(page.getByText("En attente d'envoi")).toBeVisible();
    await pause(page, 3500);
    // Retour d'Internet : l'opération part toute seule.
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText("Internet est revenu.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("En attente d'envoi")).toHaveCount(0, { timeout: 30_000 });
    await pause(page, 2500);
    await tap(page, page.getByRole("link", { name: /Retour à l'application/ }), 2500);
    await page.goto("/history");
    await expect(page.getByText("Cheikh Ndour").first()).toBeVisible();
    await pause(page, 4000);
  });
});
