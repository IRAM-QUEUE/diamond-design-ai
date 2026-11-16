import { readFile } from "node:fs/promises";
import { create, type Font } from "fontkit";
import bidiFactory from "bidi-js";
import path from "node:path";
import sharp from "sharp";
import { jewelryFonts } from "@/config/jewelry-fonts";
import { jewelryLetteringStyles } from "@/config/jewelry-lettering-styles";
import { containsArabicText } from "@/lib/personalization";
import type { DesignProfile } from "@/types/design";

type ReferencePreferences = Pick<DesignProfile, "fontPreference" | "letteringStylePreference">;
const canvasWidth = 1024;
const canvasHeight = 512;
const maxDataUrlBytes = 1_000_000;
const bidi = bidiFactory();
const fontCache = new Map<string, Promise<Font>>();

export function resolveInscriptionReferenceFont(inscription: string, preferences?: ReferencePreferences) {
  const arabic = containsArabicText(inscription);
  const supportsScript = (font: (typeof jewelryFonts)[number]) => arabic ? font.supportsArabic : font.supportsLatin;
  const selected = jewelryFonts.find((font) =>
    [font.id, font.name.toLowerCase()].includes(preferences?.fontPreference.trim().toLowerCase() ?? "") && supportsScript(font));
  if (selected) return selected;
  const style = jewelryLetteringStyles.find((item) =>
    [item.id, item.name.toLowerCase()].includes(preferences?.letteringStylePreference.trim().toLowerCase() ?? ""));
  const fallbackId = style?.referenceFonts[arabic ? "arabic" : "latin"] ?? (arabic ? "noto-naskh-arabic" : "lora");
  return jewelryFonts.find((font) => font.id === fallbackId && supportsScript(font)) ??
    jewelryFonts.find((font) => font.id === (arabic ? "noto-naskh-arabic" : "lora"))!;
}

export async function createInscriptionReferenceDataUrl(inscription: string, preferences?: ReferencePreferences) {
  const exactText = inscription.normalize("NFC").trim();
  if (!exactText) return undefined;

  try {
    const font = resolveInscriptionReferenceFont(exactText, preferences);
    const paths = await shapeInscription(exactText, font.id);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
      <rect width="100%" height="100%" fill="white"/>
      <g fill="black" transform="translate(${paths.offsetX} ${paths.offsetY}) scale(${paths.scale})">${paths.svg}</g>
    </svg>`;
    // Rasterize font outlines, not SVG text. This avoids all OS/fontconfig fallback.
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    return Buffer.byteLength(dataUrl) <= maxDataUrlBytes ? dataUrl : undefined;
  } catch {
    // A missing reference must not prevent delivery of a generated concept.
    console.error("Exact inscription reference image could not be created.");
    return undefined;
  }
}

function loadFont(id: string) {
  let font = fontCache.get(id);
  if (!font) {
    font = readFile(path.join(process.cwd(), "public", "fonts", "jewelry", `${id}.ttf`)).then((buffer) => {
      const parsed = create(buffer);
      if (!("layout" in parsed)) throw new Error("Expected a single catalog font");
      return parsed;
    });
    fontCache.set(id, font);
  }
  return font;
}

async function shapeInscription(text: string, selectedFontId: string) {
  const embedding = bidi.getEmbeddingLevels(text);
  const runs: Array<{ start: number; end: number; level: number }> = [];
  const runByIndex: number[] = [];
  for (let index = 0; index < text.length; index++) {
    if (!index || embedding.levels[index] !== embedding.levels[index - 1]) {
      runs.push({ start: index, end: index + 1, level: embedding.levels[index] });
    } else runs[runs.length - 1].end = index + 1;
    runByIndex[index] = runs.length - 1;
  }
  const visualOrder = [...new Set(bidi.getReorderedIndices(text, embedding).map((index) => runByIndex[index]))];
  const selectedFont = await loadFont(selectedFontId);
  const paths: string[] = [];
  let cursor = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const runIndex of visualOrder) {
    const run = runs[runIndex];
    const value = text.slice(run.start, run.end);
    let font = selectedFont;
    if (Array.from(value).some((character) => !font.hasGlyphForCodePoint(character.codePointAt(0)!))) {
      font = await loadFont(containsArabicText(value) ? "noto-naskh-arabic" : "lora");
    }
    const shaped = font.layout(value, undefined, undefined, undefined, run.level % 2 ? "rtl" : "ltr");
    const unit = 1000 / font.unitsPerEm;
    shaped.glyphs.forEach((glyph, index) => {
      if (glyph.id === 0) throw new Error("Unsupported inscription glyph");
      const position = shaped.positions[index];
      const x = cursor + position.xOffset * unit;
      const y = -position.yOffset * unit;
      const d = glyph.path.toSVG();
      if (d) {
        paths.push(`<path d="${d}" transform="translate(${x} ${y}) scale(${unit} ${-unit})"/>`);
        minX = Math.min(minX, x + glyph.bbox.minX * unit);
        maxX = Math.max(maxX, x + glyph.bbox.maxX * unit);
        minY = Math.min(minY, y - glyph.bbox.maxY * unit);
        maxY = Math.max(maxY, y - glyph.bbox.minY * unit);
      }
      cursor += position.xAdvance * unit;
    });
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) throw new Error("Empty inscription outlines");
  const scale = Math.min(896 / (maxX - minX), 384 / (maxY - minY));
  return {
    svg: paths.join(""), scale,
    offsetX: (canvasWidth - (maxX - minX) * scale) / 2 - minX * scale,
    offsetY: (canvasHeight - (maxY - minY) * scale) / 2 - minY * scale
  };
}
