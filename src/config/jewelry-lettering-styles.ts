export type JewelryLetteringStyle = {
  id: string;
  name: string;
  previewImage: string;
  tags: string[];
  note: string;
  constructionDirection: string;
  supportsArabic: boolean;
  supportsLatin: boolean;
};

export const jewelryLetteringStyles: JewelryLetteringStyle[] = [
  {
    id: "flowing-calligraphy",
    name: "Flowing Calligraphy",
    previewImage: "/lettering-styles/flowing-calligraphy.png",
    tags: ["Sweeping", "Romantic", "Connected"],
    note: "Graceful connected strokes and extended flourishes inspired by traditional name jewelry.",
    constructionDirection:
      "flowing freestanding calligraphy with graceful connected strokes, elegant sweeping flourishes, balanced negative space, two secure chain attachments, and discreet structural bridges wherever the script does not naturally connect",
    supportsArabic: true,
    supportsLatin: true
  },
  {
    id: "sculptural-interlock",
    name: "Sculptural Interlock",
    previewImage: "/lettering-styles/sculptural-interlock.png",
    tags: ["Layered", "Artistic", "Bold"],
    note: "Compact overlapping strokes create a dimensional calligraphic statement with strong visual presence.",
    constructionDirection:
      "compact sculptural lettering with bold interlocking strokes, layered depth, intentional negative space, secure hidden supports, and a balanced silhouette that remains clearly readable and manufacturable",
    supportsArabic: true,
    supportsLatin: true
  },
  {
    id: "minimal-signature",
    name: "Minimal Signature",
    previewImage: "/lettering-styles/minimal-signature.png",
    tags: ["Delicate", "Modern", "Everyday"],
    note: "A restrained continuous-line treatment for light, clean, everyday personalized pieces.",
    constructionDirection:
      "slender continuous-line signature lettering with clean curves, minimal ornament, realistic metal thickness, and a subtle integrated support rail that keeps every letter and mark physically secure",
    supportsArabic: true,
    supportsLatin: true
  },
  {
    id: "geometric-kufi",
    name: "Geometric Kufi",
    previewImage: "/lettering-styles/geometric-kufi.png",
    tags: ["Angular", "Architectural", "Contemporary"],
    note: "Precise angular geometry turns Arabic lettering into a bold architectural jewelry form.",
    constructionDirection:
      "architectural Kufi-inspired Arabic lettering with precise angular strokes, stepped corners, rectangular geometry, a coherent structural baseline, and securely integrated dots and chain connections",
    supportsArabic: true,
    supportsLatin: false
  },
  {
    id: "diamond-pave",
    name: "Diamond Pavé Lettering",
    previewImage: "/lettering-styles/diamond-pave.png",
    tags: ["Diamond-set", "Brilliant", "Luxury"],
    note: "Micro-pavé diamonds illuminate the main letter strokes while polished metal edges preserve clarity.",
    constructionDirection:
      "solid-metal lettering with a controlled row of securely micro-pave-set round diamonds across the front-facing main strokes, polished metal borders, a discreet rear support, and no stones or marks outside the connected jewelry assembly",
    supportsArabic: true,
    supportsLatin: true
  },
  {
    id: "framed-medallion",
    name: "Framed Medallion",
    previewImage: "/lettering-styles/framed-medallion.png",
    tags: ["Openwork", "Framed", "Heirloom"],
    note: "Openwork lettering is anchored inside a refined frame for an heirloom-ready pendant silhouette.",
    constructionDirection:
      "openwork lettering integrated inside a slim refined medallion frame, touching the rim at several deliberate support points, with elegant negative space and symmetrical secure chain attachments",
    supportsArabic: true,
    supportsLatin: true
  }
];

export function getJewelryLetteringStyleById(id: string | null | undefined) {
  if (!id) return undefined;
  return jewelryLetteringStyles.find((style) => style.id === id);
}
