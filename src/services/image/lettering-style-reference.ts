import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { jewelryLetteringStyles } from "@/config/jewelry-lettering-styles";

// Resolve only catalog-owned assets, never a caller-supplied filesystem path or URL.
export async function createLetteringStyleReferenceDataUrl(preference: string) {
  const style = jewelryLetteringStyles.find((item) => item.name.toLowerCase() === preference.trim().toLowerCase());
  if (!style) return undefined;
  const source = await readFile(path.join(process.cwd(), "public", style.previewImage));
  const image = await sharp(source).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${image.toString("base64")}`;
}
