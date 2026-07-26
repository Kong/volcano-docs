/**
 * Custom ESLint rule: prefer-function-methods  (warn — a nudge, not a hard gate)
 *
 * Inside a component/hook, prefer the `function` keyword for local named helpers
 * over arrow-function consts:
 *
 *   function Component() {
 *     // ✗ discouraged
 *     const handleClick = () => { … };
 *     // ✓ preferred
 *     function handleClick() { … }
 *   }
 *
 * Exemptions are automatic, not special-cased: anything whose initializer is a
 * *call* — `useCallback(() => …, [])`, `useMemo(() => …, [])`, `data.map(x => …)`
 * — has a CallExpression initializer, so it is never matched. `useCallback`/
 * `useMemo` MUST keep their arrow arguments (the hook needs a function value and
 * a stable identity), so they are intentionally left alone.
 *
 * Scope (low-noise): only a *nested* (inside another function) `const <camelCase>
 * = (…) => …`. PascalCase arrows (components) are handled by
 * `prefer-function-component`; module-level utility arrows are not touched.
 */
function isNestedInFunction(node) {
  let p = node.parent;
  while (p) {
    if (
      p.type === "FunctionDeclaration" ||
      p.type === "FunctionExpression" ||
      p.type === "ArrowFunctionExpression"
    ) {
      return true;
    }
    if (p.type === "Program") return false;
    p = p.parent;
  }
  return false;
}

export const preferFunctionMethods = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer the `function` keyword for local named helpers inside components/hooks (arrow args to useCallback/useMemo are exempt).",
    },
    messages: {
      useFunction:
        "Prefer `function {{name}}(…) { … }` over an arrow-function const for a local helper. (Arrow args to useCallback/useMemo are fine.)",
    },
    schema: [],
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== "Identifier") return;
        const name = node.id.name;
        if (!/^[a-z]/.test(name)) return; // methods are camelCase; components handled elsewhere
        if (!node.init || node.init.type !== "ArrowFunctionExpression") return; // call-wrapped (useCallback/map/…) auto-exempt
        if (!isNestedInFunction(node)) return; // only local helpers, not module-level utilities
        context.report({ node: node.id, messageId: "useFunction", data: { name } });
      },
    };
  },
};
