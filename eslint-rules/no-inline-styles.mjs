/**
 * Custom ESLint rule: no-inline-styles
 *
 * Forbids the `style` JSX prop UNLESS every key in the object expression
 * starts with "--" (CSS custom properties).
 *
 * Allowed:
 *   style={{ '--my-var': value } as React.CSSProperties}
 *
 * Forbidden:
 *   style={{ color: 'red' }}
 *   style={{ '--my-var': value, color: 'red' }}  // mixed
 *   style={someVariable}  // can't statically verify
 *   style={{ ...spread }}  // can't statically verify
 */
export const noInlineStyles = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow inline style prop unless it only sets CSS custom properties (--variables)",
    },
    messages: {
      noInlineStyle:
        "Inline styles are not allowed. Use CSS classes with design system tokens instead. See CLAUDE.md for details.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.name !== "style") return;

        const value = node.value;
        // style="string" — always forbid
        if (!value || value.type === "Literal") {
          context.report({ node, messageId: "noInlineStyle" });
          return;
        }

        // style={expression} — unwrap JSXExpressionContainer
        if (value.type !== "JSXExpressionContainer") return;
        let expr = value.expression;

        // Unwrap TSAsExpression: { ... } as React.CSSProperties
        while (expr.type === "TSAsExpression") {
          expr = expr.expression;
        }

        // If it's not an object expression, we can't verify → forbid
        if (expr.type !== "ObjectExpression") {
          context.report({ node, messageId: "noInlineStyle" });
          return;
        }

        // Check every property key
        for (const prop of expr.properties) {
          // Spread elements can't be verified
          if (prop.type === "SpreadElement") {
            context.report({ node, messageId: "noInlineStyle" });
            return;
          }

          const key = prop.key;
          let keyName = null;

          if (key.type === "Literal" && typeof key.value === "string") {
            keyName = key.value;
          } else if (key.type === "Identifier") {
            keyName = key.name;
          }

          // If we can't determine the key name, or it doesn't start with "--", forbid
          if (!keyName || !keyName.startsWith("--")) {
            context.report({ node, messageId: "noInlineStyle" });
            return;
          }
        }

        // All keys start with "--" — this is a CSS custom properties-only style, allow it
      },
    };
  },
};
