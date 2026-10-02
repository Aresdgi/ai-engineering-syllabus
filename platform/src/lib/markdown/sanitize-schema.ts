import { defaultSchema } from "rehype-sanitize";

/**
 * Allowlist de saneado para el Markdown y el HTML embebido del corpus
 * (ADR-014). Mantiene la fidelidad del contenido real (tablas GFM, task
 * lists, `details`/`summary`, imágenes y divs) y descarta cualquier vector
 * ejecutable: `script`, `style`, `iframe`, `object`/`embed`, atributos `on*`
 * y URLs `javascript:`/`data:`.
 */
export const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "em",
    "strong",
    "del",
    "a",
    "img",
    "hr",
    "br",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "details",
    "summary",
    "input",
    "span",
    "div",
  ],
  attributes: {
    a: ["href", "title"],
    img: ["src", "alt", "title", "width", "height"],
    input: [["type", "checkbox"], "checked", "disabled"],
    ol: ["start"],
    th: ["align"],
    td: ["align"],
  },
  protocols: {
    href: ["http", "https", "mailto"],
    src: ["http", "https"],
  },
};
