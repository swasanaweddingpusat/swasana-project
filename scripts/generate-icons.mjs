import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "icons");
const source = join(root, "public", "logo-swasana.png");

mkdirSync(outDir, { recursive: true });

const sizes = [
  { name: "icon-192x192.png", size: 192 },
  { name: "icon-512x512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "badge-72x72.png", size: 72 },
];

for (const { name, size } of sizes) {
  await sharp(source)
    .resize(size, size, { fit: "contain", background: { r: 250, g: 247, b: 242, alpha: 1 } })
    .png()
    .toFile(join(outDir, name));
  console.log(`Generated ${name}`);
}

// Maskable icon: 512x512 with 20% padding (safe area = 80% center)
const maskableInner = Math.round(512 * 0.8);
const maskablePad = Math.round((512 - maskableInner) / 2);
await sharp(source)
  .resize(maskableInner, maskableInner, { fit: "contain", background: { r: 250, g: 247, b: 242, alpha: 1 } })
  .extend({
    top: maskablePad,
    bottom: maskablePad,
    left: maskablePad,
    right: maskablePad,
    background: { r: 250, g: 247, b: 242, alpha: 1 },
  })
  .png()
  .toFile(join(outDir, "icon-maskable-512x512.png"));
console.log("Generated icon-maskable-512x512.png");

console.log("All icons generated!");
