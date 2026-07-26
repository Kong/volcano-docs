/**
 * Custom ESLint rule: no-interface-props
 *
 * Component prop shapes must be declared with `type`, not `interface`, for
 * consistency across the codebase (see PR #98: "we declare Prop type in other
 * places but inline interface here" / "lets declare prop type right above the
 * function"). This rule flags any `interface <Name>Props { … }` and asks for a
 * `type <Name>Props = { … }` alias instead.
 *
 *   // ✗ forbidden
 *   interface ButtonProps extends React.ComponentProps<"button"> { … }
 *
 *   // ✓ required
 *   type ButtonProps = React.ComponentProps<"button"> & { … };
 *
 * Not auto-fixed: `interface`→`type` conversion must preserve `extends`/intersection
 * semantics, which is safer to do by hand.
 */
export const noInterfaceProps = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require `type` (not `interface`) for component prop shapes (`*Props`).",
    },
    messages: {
      useType:
        'Declare props with `type {{name}} = …` instead of `interface {{name}}`. Use a `type` alias (with `&` for extension) for prop shapes. See AGENTS.md.',
    },
    schema: [],
  },
  create(context) {
    return {
      TSInterfaceDeclaration(node) {
        const name = node.id && node.id.name;
        if (name && /Props$/.test(name)) {
          context.report({ node: node.id, messageId: "useType", data: { name } });
        }
      },
    };
  },
};
