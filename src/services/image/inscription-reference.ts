import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const canvasWidth = 1024;
const canvasHeight = 512;
const maxDataUrlBytes = 1_000_000;

export async function createInscriptionReferenceDataUrl(inscription: string) {
  const exactText = inscription.normalize("NFC").trim();
  if (!exactText) return undefined;

  try {
    const font = await readFile(path.join(process.cwd(), "public", "fonts", "NotoSansArabic-Regular.ttf"));
    const fontSize = getFontSize(exactText);
    const svg = `
      <svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          @font-face {
            font-family: "ExactInscription";
            src: url("data:font/ttf;base64,${font.toString("base64")}") format("truetype");
          }
          text {
            font-family: "ExactInscription", sans-serif;
            font-size: ${fontSize}px;
            font-weight: 400;
          }
        </style>
        <rect width="100%" height="100%" fill="#ffffff" />
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" direction="${isArabic(exactText) ? "rtl" : "ltr"}" fill="#000000" lang="${isArabic(exactText) ? "ar" : "en"}">${escapeXml(exactText)}</text>
      </svg>`;
    const png = await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

    return Buffer.byteLength(dataUrl) <= maxDataUrlBytes ? dataUrl : undefined;
  } catch (error) {
    console.error("Exact inscription reference image could not be created.", error);
    return undefined;
  }
}

function getFontSize(value: string) {
  const characterCount = Array.from(value).length;
  if (characterCount <= 4) return 220;
  if (characterCount <= 7) return 180;
  if (characterCount <= 11) return 140;
  if (characterCount <= 16) return 105;
  return 78;
}

function isArabic(value: string) {
  return /\p{Script=Arabic}/u.test(value);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
