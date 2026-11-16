declare module "bidi-js" {
  type Embedding = { levels: Uint8Array; paragraphs: Array<{ start: number; end: number; level: number }> };
  export default function bidiFactory(): {
    getEmbeddingLevels(text: string): Embedding;
    getReorderedIndices(text: string, embedding: Embedding): number[];
  };
}
