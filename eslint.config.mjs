import next from "eslint-config-next";
import { noInlineStyles } from "./eslint-rules/no-inline-styles.mjs";
import { noArbitraryTailwind } from "./eslint-rules/no-arbitrary-tailwind.mjs";
import { noInterfaceProps } from "./eslint-rules/no-interface-props.mjs";
import { preferFunctionComponent } from "./eslint-rules/prefer-function-component.mjs";
import { preferFunctionMethods } from "./eslint-rules/prefer-function-methods.mjs";

// Volcano design-system + pattern plugin, mirrored from volcano-web so the docs
// site matches its styles and conventions.
const volcanoPlugin = {
  rules: {
    "no-inline-styles": noInlineStyles,
    "no-arbitrary-tailwind": noArbitraryTailwind,
    "no-interface-props": noInterfaceProps,
    "prefer-function-component": preferFunctionComponent,
    "prefer-function-methods": preferFunctionMethods,
  },
};

// Next 16 ships a native flat ESLint config (no FlatCompat needed). It also
// registers the react / jsx-a11y plugins, whose rules we tune below.
const eslintConfig = [
  ...next,
  {
    ignores: [
      ".next/**",
      ".source/**",
      "out/**",
      "build/**",
      "content/**",
      "scripts/**",
      "eslint-rules/**",
    ],
  },
  {
    // Volcano house style for app source — same rule set as volcano-web's root config.
    files: ["src/**/*.{tsx,jsx}"],
    plugins: { volcano: volcanoPlugin },
    settings: { react: { version: "detect" } },
    rules: {
      // NEVER use inline styles for token values (CSS custom props excepted).
      "volcano/no-inline-styles": "error",
      // NEVER encode visual values in Tailwind arbitrary classNames.
      "volcano/no-arbitrary-tailwind": "error",
      // `type` (not `interface`) for prop shapes; `function` keyword for components.
      "volcano/no-interface-props": "error",
      "volcano/prefer-function-component": "error",
      // Nudge (not a hard gate): function keyword for local helpers.
      "volcano/prefer-function-methods": "warn",
      // No inline arrow functions / .bind() in JSX props — extract a named handler.
      "react/jsx-no-bind": [
        "warn",
        { allowArrowFunctions: false, allowBind: false, allowFunctions: true, ignoreRefs: true },
      ],
      // Avoid ternaries (prefer if/else, early returns, or `&&` for JSX).
      "no-nested-ternary": "error",
      "no-ternary": "warn",
      // Curated a11y rules (high-signal); warn-level ratchet where legacy-prone.
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": "error",
    },
  },
  {
    // Allow underscore-prefixed variables to be unused (matches apps/web).
    // Scoped to TS files, where eslint-config-next registers @typescript-eslint.
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
