import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/phone";

/**
 * Relevé de compte client en PDF (A4). Fonction pure : données -> octets du PDF.
 * Les polices standard PDF (Helvetica) ne couvrent que l'alphabet latin (WinAnsi) :
 * les autres caractères sont remplacés (voir `pdfSafe`).
 */

export type StatementTransaction = {
  id: string;
  type: "DEBT" | "REPAYMENT" | "REVERSAL";
  amount: number;
  balanceEffect: number;
  description: string | null;
  occurredAt: string;
  isReversed: boolean;
};

export type StatementData = {
  shop: { name: string; phone: string | null; address: string | null };
  customer: { name: string; phone: string | null };
  /** Bornes incluses "YYYY-MM-DD", ou null pour tout l'historique. */
  from: string | null;
  to: string | null;
  openingBalance: number;
  /** Opérations de la période, ordre chronologique. */
  transactions: StatementTransaction[];
  generatedAt: Date;
};

const LABELS = { DEBT: "Dette", REPAYMENT: "Remboursement", REVERSAL: "Annulation" } as const;

const PAGE = { width: 595.28, height: 841.89, margin: 40 };
const COLORS = {
  text: rgb(0.07, 0.09, 0.15),
  muted: rgb(0.29, 0.33, 0.39),
  brand: rgb(0.06, 0.42, 0.31),
  debt: rgb(0.71, 0.14, 0.09),
  repayment: rgb(0.02, 0.46, 0.28),
  line: rgb(0.82, 0.84, 0.86),
  band: rgb(0.96, 0.97, 0.96),
};

// Colonnes du tableau : [titre, largeur, alignement]
const COLUMNS = [
  { title: "Date", width: 62, align: "left" },
  { title: "Opération", width: 88, align: "left" },
  { title: "Détail", width: 145, align: "left" },
  { title: "Dette (+)", width: 72, align: "right" },
  { title: "Payé (-)", width: 72, align: "right" },
  { title: "Solde", width: 76, align: "right" },
] as const;

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Rend un texte affichable avec Helvetica (WinAnsi). */
export function pdfSafe(text: string): string {
  return Array.from(text.replace(/[  ]/g, " ").replace(/−/g, "-"))
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) return ch;
      if (ch === "\n" || ch === "\t") return " ";
      const base = ch.normalize("NFD")[0];
      return base && base.codePointAt(0)! <= 0x7e ? base : "?";
    })
    .join("");
}

/** 12500 -> "12 500" (espaces simples, compatibles WinAnsi). */
function amount(value: number): string {
  const sign = value < 0 ? "-" : "";
  return sign + Math.abs(Math.round(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function fcfa(value: number): string {
  return `${amount(value)} FCFA`;
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const safe = pdfSafe(text);
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
  let cut = safe;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export async function renderStatementPdf(data: StatementData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`Relevé - ${data.customer.name}`));
  pdf.setProducer("BoutikDëkk");
  pdf.setCreationDate(data.generatedAt);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const text = (
    value: string,
    x: number,
    yPos: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: "left" | "right"; width?: number } = {},
  ) => {
    const size = opts.size ?? 9;
    const font = opts.font ?? regular;
    const safe = pdfSafe(value);
    const dx = opts.align === "right" && opts.width ? opts.width - font.widthOfTextAtSize(safe, size) : 0;
    page.drawText(safe, { x: x + dx, y: yPos, size, font, color: opts.color ?? COLORS.text });
  };

  const newPage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    y = PAGE.height - PAGE.margin;
  };

  const tableHeader = () => {
    page.drawRectangle({ x: PAGE.margin, y: y - 6, width: PAGE.width - 2 * PAGE.margin, height: 20, color: COLORS.band });
    let x = PAGE.margin + 4;
    for (const col of COLUMNS) {
      text(col.title, x, y, { font: bold, size: 9, align: col.align, width: col.width - 8, color: COLORS.muted });
      x += col.width;
    }
    y -= 22;
  };

  // --- En-tête --------------------------------------------------------------
  newPage();
  text(data.shop.name, PAGE.margin, y - 4, { font: bold, size: 18, color: COLORS.brand });
  y -= 22;
  const shopLine = [data.shop.address, data.shop.phone ? formatPhone(data.shop.phone) : null].filter(Boolean).join("  ·  ");
  if (shopLine) {
    text(shopLine, PAGE.margin, y, { color: COLORS.muted });
    y -= 14;
  }
  y -= 14;
  text("RELEVÉ DE COMPTE", PAGE.margin, y, { font: bold, size: 14 });
  y -= 22;

  text("Client :", PAGE.margin, y, { color: COLORS.muted, size: 10 });
  text(data.customer.name, PAGE.margin + 70, y, { font: bold, size: 10 });
  y -= 14;
  if (data.customer.phone) {
    text("Téléphone :", PAGE.margin, y, { color: COLORS.muted, size: 10 });
    text(formatPhone(data.customer.phone), PAGE.margin + 70, y, { size: 10 });
    y -= 14;
  }
  text("Période :", PAGE.margin, y, { color: COLORS.muted, size: 10 });
  const period =
    data.from || data.to
      ? `du ${data.from ? formatDate(data.from) : "début"} au ${formatDate(data.to ?? data.generatedAt)}`
      : "toutes les opérations";
  text(period, PAGE.margin + 70, y, { size: 10 });
  y -= 14;
  text("Édité le :", PAGE.margin, y, { color: COLORS.muted, size: 10 });
  text(formatDate(data.generatedAt), PAGE.margin + 70, y, { size: 10 });
  y -= 24;

  // --- Résumé ---------------------------------------------------------------
  const counted = data.transactions.filter((tx) => tx.type !== "REVERSAL" && !tx.isReversed);
  const totalDebts = counted.filter((tx) => tx.type === "DEBT").reduce((s, tx) => s + tx.amount, 0);
  const totalPaid = counted.filter((tx) => tx.type === "REPAYMENT").reduce((s, tx) => s + tx.amount, 0);
  const closing = data.openingBalance + data.transactions.reduce((s, tx) => s + tx.balanceEffect, 0);

  const summary: [string, string, ReturnType<typeof rgb>][] = [
    ["Solde au début de la période", fcfa(data.openingBalance), COLORS.text],
    ["Dettes de la période", `+ ${fcfa(totalDebts)}`, COLORS.debt],
    ["Remboursements de la période", `- ${fcfa(totalPaid)}`, COLORS.repayment],
  ];
  const boxHeight = summary.length * 16 + 34;
  page.drawRectangle({
    x: PAGE.margin,
    y: y - boxHeight + 12,
    width: PAGE.width - 2 * PAGE.margin,
    height: boxHeight,
    borderColor: COLORS.line,
    borderWidth: 1,
  });
  for (const [label, value, color] of summary) {
    text(label, PAGE.margin + 10, y, { size: 10, color: COLORS.muted });
    text(value, PAGE.margin + 10, y, { size: 10, color, align: "right", width: PAGE.width - 2 * PAGE.margin - 20 });
    y -= 16;
  }
  y -= 4;
  text("SOLDE DÛ", PAGE.margin + 10, y, { font: bold, size: 12 });
  text(fcfa(closing), PAGE.margin + 10, y, {
    font: bold,
    size: 12,
    color: closing > 0 ? COLORS.debt : COLORS.repayment,
    align: "right",
    width: PAGE.width - 2 * PAGE.margin - 20,
  });
  y -= 36;

  // --- Tableau --------------------------------------------------------------
  tableHeader();
  let running = data.openingBalance;
  if (!data.transactions.length) {
    text("Aucune opération sur cette période.", PAGE.margin + 4, y, { color: COLORS.muted });
    y -= 16;
  }
  for (const tx of data.transactions) {
    if (y < PAGE.margin + 30) {
      newPage();
      tableHeader();
    }
    running += tx.balanceEffect;
    const cells = [
      formatDate(tx.occurredAt),
      LABELS[tx.type] + (tx.isReversed ? " (annulée)" : ""),
      tx.description ?? "",
      tx.balanceEffect > 0 ? amount(tx.amount) : "",
      tx.balanceEffect < 0 ? amount(tx.amount) : "",
      amount(running),
    ];
    let x = PAGE.margin + 4;
    cells.forEach((cell, i) => {
      const col = COLUMNS[i];
      const muted = tx.isReversed || tx.type === "REVERSAL";
      const color = i === 3 ? COLORS.debt : i === 4 ? COLORS.repayment : muted ? COLORS.muted : COLORS.text;
      text(fit(cell, regular, 9, col.width - 8), x, y, { color, align: col.align, width: col.width - 8, font: i === 5 ? bold : regular });
      x += col.width;
    });
    page.drawLine({
      start: { x: PAGE.margin, y: y - 5 },
      end: { x: PAGE.width - PAGE.margin, y: y - 5 },
      thickness: 0.5,
      color: COLORS.line,
    });
    y -= 17;
  }

  // --- Pied de page ---------------------------------------------------------
  pages.forEach((p, i) => {
    page = p;
    text(`BoutikDëkk  ·  ${data.shop.name}`, PAGE.margin, 22, { size: 8, color: COLORS.muted });
    text(`Page ${i + 1} / ${pages.length}`, PAGE.margin, 22, {
      size: 8,
      color: COLORS.muted,
      align: "right",
      width: PAGE.width - 2 * PAGE.margin,
    });
  });

  return pdf.save();
}
