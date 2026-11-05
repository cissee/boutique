// Remplit le compte de démonstration (vidéos YouTube) avec des clients et un historique crédibles.
// Usage : node scripts/video/seed-demo.mjs   (lit .env.local et .env.demo.local)
// Rejouable sans doublon : clients retrouvés par leur nom, opérations à clé d'idempotence fixe.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

function load(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...load(".env.local"), ...load(".env.demo.local") };
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!env.DEMO_USER_EMAIL || !env.DEMO_USER_PASSWORD) {
  console.error("Renseignez DEMO_USER_EMAIL et DEMO_USER_PASSWORD dans .env.demo.local");
  process.exit(1);
}

/** UUID stable dérivé d'un libellé : rejouer le script ne crée pas de doublon. */
const stableId = (label) => {
  const h = createHash("md5").update(`boutikdekk-demo:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const daysAgo = (d, hour = 10) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() - d);
  t.setUTCHours(hour, 15, 0, 0);
  return d === 0 ? new Date().toISOString() : t.toISOString();
};

const auth = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: env.DEMO_USER_EMAIL, password: env.DEMO_USER_PASSWORD }),
}).then((r) => r.json());
if (!auth.access_token) throw new Error(`Connexion impossible : ${auth.error_code ?? auth.msg}`);
const H = { apikey: KEY, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" };

const api = async (path, init = {}) => {
  const res = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${path} : ${body?.message ?? res.status}`);
  return body;
};

const [membership] = await api(`shop_members?select=shop_id,role,shop:shops(name)&user_id=eq.${auth.user.id}&order=created_at&limit=1`);
if (!membership) throw new Error("Le compte de démonstration n'a pas de boutique : terminez l'accueil guidé d'abord.");
const shopId = membership.shop_id;
console.log(`Boutique : ${membership.shop.name}`);

// Clients fictifs (numéros 77 000 00 xx, non attribués) et leur historique.
const CUSTOMERS = [
  { name: "Awa Ndiaye", phone: "+221770000001", notes: "Quartier Médina, paie souvent par Wave",
    ops: [["DEBT", 12500, 10, "Riz 25 kg"], ["DEBT", 3000, 6, "Huile 1 L"], ["REPAYMENT", 5000, 3, "Acompte", "WAVE"]] },
  { name: "Ibrahima Sarr", phone: "+221770000002",
    ops: [["DEBT", 25000, 15, "Sac de riz 50 kg"], ["REPAYMENT", 10000, 5, null, "ORANGE_MONEY"]] },
  { name: "Mamadou Ba", phone: "+221770000003",
    ops: [["DEBT", 8000, 12, "Sucre et lait"], ["REPAYMENT", 3000, 0, null, "CASH"]] },
  { name: "Cheikh Ndour", phone: "+221770000004", ops: [["DEBT", 6000, 20, "Gaz 6 kg"]] },
  { name: "Fatou Diop", phone: "+221770000005", ops: [["DEBT", 4500, 1, "Pain et lait"]] },
  { name: "Moussa Fall", phone: "+221770000006",
    ops: [["DEBT", 7000, 8, "Sucre et thé"], ["REPAYMENT", 7000, 2, "Soldé", "CASH"]] },
  { name: "Khady Sow", phone: "+221770000007", ops: [["DEBT", 2000, 0, "Savon"]] },
  { name: "Aminata Gueye", phone: null, ops: [["DEBT", 1500, 0, "Bougies"]] },
];

for (const c of CUSTOMERS) {
  const existing = await api(`customers?select=id&shop_id=eq.${shopId}&name=eq.${encodeURIComponent(c.name)}&limit=1`);
  const id = existing[0]?.id ?? (await api("customers", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ shop_id: shopId, name: c.name, phone: c.phone, notes: c.notes ?? null }),
  }))[0].id;

  for (const [i, [kind, amount, days, note, method]] of c.ops.entries()) {
    const requestId = stableId(`${c.name}:${i}`);
    const fn = kind === "DEBT" ? "record_debt" : "record_repayment";
    const args = kind === "DEBT"
      ? { p_customer_id: id, p_amount: amount, p_client_request_id: requestId, p_description: note, p_occurred_at: daysAgo(days) }
      : { p_customer_id: id, p_amount: amount, p_client_request_id: requestId, p_payment_method: method, p_comment: note, p_occurred_at: daysAgo(days, 17) };
    await api(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  }
  console.log(`✓ ${c.name}`);
}
console.log("Données de démonstration prêtes.");
