import { Extension, type CommandProps } from "@tiptap/core";

/** Block nodes that support line height and vertical rhythm overrides. */
export const PROPOSAL_TYPOGRAPHY_BLOCK_TYPES = ["paragraph", "heading", "blockquote"] as const;

export type ProposalTypographyBlockType = (typeof PROPOSAL_TYPOGRAPHY_BLOCK_TYPES)[number];

export type ProposalLetterCase = "none" | "uppercase";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string | null) => ReturnType;
    };
    fontFamily: {
      setFontFamily: (family: string | null) => ReturnType;
    };
    fontWeight: {
      setFontWeight: (weight: string | null) => ReturnType;
    };
    proposalBlockTypography: {
      setBlockLineHeight: (value: string | null) => ReturnType;
      setBlockMarginTop: (value: string | null) => ReturnType;
      setBlockMarginBottom: (value: string | null) => ReturnType;
      setBlockLetterSpacing: (value: string | null) => ReturnType;
      setBlockLetterCase: (value: ProposalLetterCase | null) => ReturnType;
    };
  }
}

function parseUnitlessStyleNumber(raw: string | undefined, min: number, max: number): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return String(n);
}

function parseEmStyleNumber(raw: string | undefined, min: number, max: number): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)em$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return String(n);
}

function parseLetterCase(raw: string | undefined): ProposalLetterCase | null {
  if (!raw?.trim()) return null;
  const v = raw.trim().toLowerCase();
  if (v === "uppercase") return "uppercase";
  if (v === "none") return "none";
  return null;
}

function updateActiveTypographyBlock(
  { chain, state }: CommandProps,
  attrs: Record<string, unknown>,
): boolean {
  const { $from } = state.selection;
  const node = $from.parent;
  const type = node.type.name;
  if (!(PROPOSAL_TYPOGRAPHY_BLOCK_TYPES as readonly string[]).includes(type)) {
    return false;
  }
  const pos = $from.before($from.depth);
  return chain()
    .focus()
    .command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
      return true;
    })
    .run();
}

export const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => {
              const m = (el as HTMLElement).style.fontSize?.match(/^(\d+(?:\.\d+)?)px$/);
              return m ? m[1] : null;
            },
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}px` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ chain }) => {
          if (size === null) {
            return chain()
              .setMark("textStyle", { fontSize: null })
              .removeEmptyTextStyle()
              .run();
          }
          return chain().setMark("textStyle", { fontSize: size }).run();
        },
    };
  },
});

export const FontFamily = Extension.create({
  name: "fontFamily",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (el) => {
              const raw = (el as HTMLElement).style.fontFamily?.trim();
              return raw || null;
            },
            renderHTML: (attrs) =>
              attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily as string}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontFamily:
        (family) =>
        ({ chain }) => {
          if (family === null || family === "") {
            return chain()
              .setMark("textStyle", { fontFamily: null })
              .removeEmptyTextStyle()
              .run();
          }
          return chain().setMark("textStyle", { fontFamily: family }).run();
        },
    };
  },
});

export const FontWeight = Extension.create({
  name: "fontWeight",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (el) => {
              const raw = (el as HTMLElement).style.fontWeight?.trim();
              if (!raw) return null;
              const n = Number(raw);
              if (Number.isFinite(n) && n >= 100 && n <= 900) return String(Math.round(n / 100) * 100);
              if (/^\d{3}$/.test(raw)) return raw;
              const map: Record<string, string> = {
                normal: "400",
                bold: "700",
                lighter: "300",
                bolder: "700",
              };
              return map[raw.toLowerCase()] ?? null;
            },
            renderHTML: (attrs) =>
              attrs.fontWeight ? { style: `font-weight: ${attrs.fontWeight as string}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontWeight:
        (weight) =>
        ({ chain }) => {
          if (weight === null || weight === "") {
            return chain()
              .setMark("textStyle", { fontWeight: null })
              .removeEmptyTextStyle()
              .run();
          }
          return chain().setMark("textStyle", { fontWeight: weight }).run();
        },
    };
  },
});

export const ProposalBlockTypography = Extension.create({
  name: "proposalBlockTypography",
  addGlobalAttributes() {
    return [
      {
        types: [...PROPOSAL_TYPOGRAPHY_BLOCK_TYPES],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => {
              const raw = (el as HTMLElement).style.lineHeight?.trim();
              if (!raw || raw === "normal") return null;
              const unitless = parseUnitlessStyleNumber(raw, 0.5, 4);
              if (unitless) return unitless;
              const m = raw.match(/^(\d+(?:\.\d+)?)em$/i);
              return m ? parseUnitlessStyleNumber(m[1], 0.5, 4) : null;
            },
            renderHTML: (attrs) =>
              attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight as string}` } : {},
          },
          marginTop: {
            default: null,
            parseHTML: (el) => parseEmStyleNumber((el as HTMLElement).style.marginTop, 0, 8),
            renderHTML: (attrs) =>
              attrs.marginTop ? { style: `margin-top: ${attrs.marginTop as string}em` } : {},
          },
          marginBottom: {
            default: null,
            parseHTML: (el) => parseEmStyleNumber((el as HTMLElement).style.marginBottom, 0, 8),
            renderHTML: (attrs) =>
              attrs.marginBottom ? { style: `margin-bottom: ${attrs.marginBottom as string}em` } : {},
          },
          letterSpacing: {
            default: null,
            parseHTML: (el) => {
              const raw = (el as HTMLElement).style.letterSpacing?.trim();
              if (!raw || raw === "normal") return null;
              if (raw === "0" || raw === "0px") return "0";
              const m = raw.match(/^(-?\d+(?:\.\d+)?)em$/i);
              if (!m) return null;
              const n = Number(m[1]);
              if (!Number.isFinite(n) || n < -0.5 || n > 2) return null;
              return String(n);
            },
            renderHTML: (attrs) => {
              if (attrs.letterSpacing == null || attrs.letterSpacing === "") return {};
              const v = attrs.letterSpacing as string;
              if (v === "0") return { style: "letter-spacing: 0" };
              return { style: `letter-spacing: ${v}em` };
            },
          },
          letterCase: {
            default: null,
            parseHTML: (el) => parseLetterCase((el as HTMLElement).style.textTransform),
            renderHTML: (attrs) => {
              const v = attrs.letterCase as ProposalLetterCase | null;
              if (!v || v === "none") return {};
              return { style: `text-transform: ${v}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setBlockLineHeight:
        (value) => (props) => updateActiveTypographyBlock(props, { lineHeight: value }),
      setBlockMarginTop:
        (value) => (props) => updateActiveTypographyBlock(props, { marginTop: value }),
      setBlockMarginBottom:
        (value) => (props) => updateActiveTypographyBlock(props, { marginBottom: value }),
      setBlockLetterSpacing:
        (value) => (props) => updateActiveTypographyBlock(props, { letterSpacing: value }),
      setBlockLetterCase:
        (value) => (props) =>
          updateActiveTypographyBlock(props, {
            letterCase: value === null || value === "none" ? null : value,
          }),
    };
  },
});
