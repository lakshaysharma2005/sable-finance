// Generates PWA icons from an inline SVG (donut motif from the prototype thumbnail).
// Usage: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

function svg(padding) {
  // padding as fraction of canvas (maskable icons need a bigger safe zone)
  const s = 100 - padding * 200;
  const off = padding * 100;
  return Buffer.from(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="#0D0D0F"/>
  <g transform="translate(${off},${off}) scale(${s / 100})">
    <circle cx="50" cy="50" r="30" fill="none" stroke="#7FE08A" stroke-width="8"/>
    <path d="M50 50 L50 24 A26 26 0 0 1 72 62 Z" fill="#C49A6B"/>
  </g>
</svg>`);
}

const jobs = [
  { file: "icon-192.png", size: 192, pad: 0.08 },
  { file: "icon-512.png", size: 512, pad: 0.08 },
  { file: "icon-512-maskable.png", size: 512, pad: 0.18 },
  { file: "apple-touch-icon.png", size: 180, pad: 0.1 },
];

for (const job of jobs) {
  await sharp(svg(job.pad), { density: 300 }).resize(job.size, job.size).png().toFile(join(outDir, job.file));
  console.log("wrote", job.file);
}
