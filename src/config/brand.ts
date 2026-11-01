import localFont from "next/font/local";

export const brand = {
  name: "FORM by MNG",
  description: "A private jewelry design studio. Shape your ideas into considered diamond jewelry with FORM by MNG."
} as const;

// Scoped to the wordmark and home page; the workspace keeps its existing typography.
export const brandDisplay = localFont({
  src: [
    { path: "../assets/fonts/CormorantGaramond-Latin-Roman.woff2", weight: "400 500", style: "normal" },
    { path: "../assets/fonts/CormorantGaramond-Latin-Italic.woff2", weight: "400 500", style: "italic" }
  ],
  display: "swap"
});
