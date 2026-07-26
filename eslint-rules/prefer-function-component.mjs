/**
 * Custom ESLint rule: prefer-function-component
 *
 * React function components must be declared with the `function` keyword, not as
 * an arrow function assigned to a const, matching the canonical component pattern
 * in AGENTS.md:
 *
 *   // ✗ forbidden
 *   const Button = (props: ButtonProps) => { return <button … />; };
 *
 *   // ✓ required
 *   function Button(props: ButtonProps) { return <button … />; }
 *
 * Heuristic (low false-positive): flag only a `const <PascalCase> = (…) => …`
 * whose body returns JSX. Arrows wrapped in `memo`/`forwardRef`/etc. (call
 * expressions) are NOT flagged, since they cannot use the `function` keyword
 * directly. Hooks/handlers (camelCase) and non-JSX arrows are ignored.
 */
function isJSX(node) {
  return node && (node.type === "JSXElement" || node.type === "JSXFragment");
}

function returnsJSX(node, depth = 0) {
  if (!node || depth > 4) return false;
  switch (node.type) {
    case "JSXElement":
    case "JSXFragment":
      return true;
    case "ParenthesizedExpression":
      return returnsJSX(node.expression, depth + 1);
    case "ConditionalExpression":
      return returnsJSX(node.consequent, depth + 1) || returnsJSX(node.alternate, depth + 1);
    case "LogicalExpression":
      return returnsJSX(node.right, depth + 1) || returnsJSX(node.left, depth + 1);
    case "BlockStatement":
      return node.body.some(
        (s) => s.type === "ReturnStatement" && returnsJSX(s.argument, depth + 1),
      );
    default:
      return false;
  }
}

export const preferFunctionComponent = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require the `function` keyword for React function components (not arrow consts).",
    },
    messages: {
      useFunction:
        "Declare React component `{{name}}` with the `function` keyword (`function {{name}}(props) { … }`), not an arrow-function const. See AGENTS.md.",
    },
    schema: [],
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== "Identifier") return;
        const name = node.id.name;
        if (!/^[A-Z]/.test(name)) return; // components are PascalCase
        const init = node.init;
        if (!init) return;
        // Skip memo()/forwardRef()/styled() wrappers — can't use `function` directly.
        if (init.type !== "ArrowFunctionExpression" && init.type !== "FunctionExpression") return;
        if (returnsJSX(init.body)) {
          context.report({ node: node.id, messageId: "useFunction", data: { name } });
        }
      },
    };
  },
};
