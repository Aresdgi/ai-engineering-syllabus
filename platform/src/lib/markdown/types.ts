export type MarkdownUrl =
  | { kind: "internal"; href: string; targetPath: string }
  | { kind: "external"; href: string }
  | {
      kind: "source";
      href: string;
      targetPath: string;
      targetKind: "blob" | "tree" | "raw";
    }
  | { kind: "broken"; href: null; rawHref: string };

export type MarkdownUrlResolver = (rawHref: string) => MarkdownUrl;
