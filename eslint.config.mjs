import next from "eslint-config-next";

// Next 16 ships a native flat ESLint config (no FlatCompat needed).
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
    ],
  },
];

export default eslintConfig;
