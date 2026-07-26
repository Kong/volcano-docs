/**
 * Custom ESLint rule: no-arbitrary-tailwind
 *
 * Forbids Tailwind *arbitrary values* that encode visual values in className
 * strings — e.g. `text-[#737373]`, `bg-[#fff]`, `text-[12px]`, `w-[13px]`,
 * `border-[var(--x)]`. These bypass the design-system token layer.
 * (See PR #98: `text-[#737373]`, `text-[12px]`.)
 *
 * Allowed arbitrary values that are NOT visual design tokens:
 *   - layout/position helpers that have no token equivalent, e.g.
 *     `top-[50%]`, `translate-x-[-50%]`, `z-[60]`, `grid-cols-[1fr_auto]`,
 *     `min-h-[100dvh]`, `aspect-[16/9]`, `duration-[...]`.
 *
 * Heuristic: flag an arbitrary value when its prefix is a *visual* utility
 * (color/size/spacing/typography/border/shadow/radius) OR the value contains a
 * raw color (#hex / rgb / hsl) or a px/rem/em font-ish literal.
 */

// Color + typography utilities only. Layout/sizing prefixes (w, h, p, m, gap,
// top, grid-cols, z, translate, …) are intentionally NOT here — arbitrary layout
// values are legitimate; arbitrary *visual* values are not.
const VISUAL_PREFIXES = [
  "text", "bg", "border", "ring", "shadow", "fill", "stroke", "from", "via", "to",
  "rounded", "divide", "outline", "decoration", "accent", "caret", "placeholder",
  "leading", "tracking", "font",
];

// matches `prefix-[value]`, optionally with variants like `hover:` / `md:` and `!`
const ARBITRARY_RE = /(?:^|[\s:])!?([a-z][a-z-]*)-\[([^\]]+)\]/g;
const RAW_COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

// Class-merge helpers whose string-literal arguments are className fragments.
// The codebase's mandated idiom is `className={cn("base", cond && "…")}` — so the
// rule must inspect these call args, not just literal/template classNames
// (see PR #116 review: `cn("text-[#737373]", …)` slipped through).
const CLASS_MERGE_FNS = new Set(["cn", "clsx", "classnames", "classNames", "cx", "twMerge", "twJoin"]);


export const noArbitraryTailwind = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Tailwind arbitrary values that encode visual values; use design-system tokens / component CSS.",
    },
    messages: {
      noArbitrary:
        'Arbitrary Tailwind value "{{token}}" encodes a visual value. Use a design-system token (component CSS with --tokens), not className arbitrary values. See AGENTS.md.',
    },
    schema: [],
  },
  create(context) {
    function check(node, raw) {
      if (typeof raw !== "string") return;
      let m;
      ARBITRARY_RE.lastIndex = 0;
      while ((m = ARBITRARY_RE.exec(raw))) {
        const prefix = m[1];
        const value = m[2];
        const isVisualPrefix = VISUAL_PREFIXES.includes(prefix);
        const hasRawColor = RAW_COLOR_RE.test(value);
        if (isVisualPrefix || hasRawColor) {
          context.report({
            node,
            messageId: "noArbitrary",
            data: { token: `${prefix}-[${value}]` },
          });
        }
      }
    }

    // Walk a className-bearing expression, checking every string-literal fragment.
    // Handles the fragments that actually reach a className: bare strings,
    // template quasis, and the branches of `&&` / `?:` (e.g.
    // `cond && "text-[#fff]"`). Nested call expressions are NOT recursed here
    // — a nested `cn(…)` is reported by its own CallExpression visit, avoiding
    // double reports.
    function walkClassExpr(expr) {
      if (!expr) return;
      switch (expr.type) {
        case "Literal":
          check(expr, expr.value);
          break;
        case "TemplateLiteral":
          for (const q of expr.quasis) check(q, q.value.cooked);
          break;
        case "LogicalExpression":
          walkClassExpr(expr.left);
          walkClassExpr(expr.right);
          break;
        case "ConditionalExpression":
          walkClassExpr(expr.consequent);
          walkClassExpr(expr.alternate);
          break;
        case "ArrayExpression":
          for (const el of expr.elements) walkClassExpr(el);
          break;
        case "ObjectExpression":
          // clsx({ "text-[#fff]": cond }) — keys carry the class names.
          for (const p of expr.properties) {
            if (p.type === "Property" && !p.computed) {
              if (p.key.type === "Literal") check(p.key, p.key.value);
              else if (p.key.type === "TemplateLiteral")
                for (const q of p.key.quasis) check(q, q.value.cooked);
            }
          }
          break;
        default:
          break;
      }
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== "className" && node.name.name !== "class") return;
        const v = node.value;
        if (!v) return;
        if (v.type === "Literal") {
          check(node, v.value);
        } else if (v.type === "JSXExpressionContainer") {
          const expr = v.expression;
          if (expr.type === "Literal") check(node, expr.value);
          if (expr.type === "TemplateLiteral") {
            for (const q of expr.quasis) check(node, q.value.cooked);
          }
        }
      },
      // className={cn("…", cond && "…")} — inspect all string args of class-merge
      // helpers anywhere they appear (also catches className built into a var).
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || !CLASS_MERGE_FNS.has(node.callee.name)) return;
        for (const arg of node.arguments) {
          if (arg.type === "SpreadElement") walkClassExpr(arg.argument);
          else walkClassExpr(arg);
        }
      },
    };
  },
};
