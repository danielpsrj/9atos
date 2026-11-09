// eslint-rules/no-hardcoded-strings.mjs
//
// Forbids hardcoded user-facing strings in JSX. Every visible text node in a
// feature screen must come from a next-intl dictionary (t('key')). This enforces
// FR-14 / AD-07: the UI is locale-aware from day 1, and no user-facing string
// is ever hardcoded in a component.
//
// Two kinds of JSXText are not user-facing translatable strings and are allowed:
//   - whitespace-only text (indentation between elements), and
//   - pure-numeric tokens (e.g. the "404" status code, identical in every locale).
//
// The design-verification pages (/theme, /components) and the Shadcn UI
// primitives (src/components/ui) are excluded in the ESLint config — they are
// not feature screens.
//
// JSDoc types (rather than TypeScript) because this is a plain .mjs ESLint
// plugin file linted with the default project, not the app's tsconfig project.

/** @typedef {import('eslint').Rule.RuleContext} RuleContext */
/** @typedef {import('eslint').Rule.Node} RuleNode */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid hardcoded user-facing strings in JSX; use a next-intl translation key instead.',
    },
    messages: {
      hardcoded:
        'Hardcoded user-facing string "{{text}}". Use a next-intl translation key (t("...")) instead.',
    },
    schema: [],
  },
  /** @param {RuleContext} context */
  create(context) {
    return {
      /** @param {RuleNode} node */
      JSXText(node) {
        // A JSXText node carries its raw text in `value`; the base Rule.Node
        // type doesn't expose it, so narrow it here.
        const text = /** @type {{ value: string }} */ (node).value.trim();
        if (text.length === 0) return; // whitespace between elements
        if (/^\d+$/.test(text)) return; // pure numeric (e.g. "404")
        const preview = text.length > 40 ? `${text.slice(0, 40)}…` : text;
        context.report({ node, messageId: 'hardcoded', data: { text: preview } });
      },
    };
  },
};

export default rule;
