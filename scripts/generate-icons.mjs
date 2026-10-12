// Génère les icônes PNG de la PWA à partir de public/icons/icon.svg.
// Usage : node scripts/generate-icons.mjs
import sharp from "sharp";

const source = "public/icons/icon.svg";
const outputs = [
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "public/icons/maskable-512.png", size: 512 },
  { file: "public/icons/apple-touch-icon.png", size: 180 },
];

for (const { file, size } of outputs) {
  await sharp(source, { density: 300 }).resize(size, size).png().toFile(file);
  console.log(`✓ ${file}`);
}
