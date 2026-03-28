import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";

const tsRecommended = tsPlugin.configs["flat/recommended"];

export default [
  {
    ignores: ["dist/", "release/", "build/", "node_modules/", "src/main/starter_modules/"],
  },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-case-declarations": "off",
      "no-extra-boolean-cast": "warn",
      "no-regex-spaces": "warn",
      "no-prototype-builtins": "off",
      "no-unreachable": "warn",
    },
  },

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsRecommended[1].rules,
      ...tsRecommended[2].rules,
      "@typescript-eslint/no-require-imports": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    files: ["**/*.{js,jsx,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooksPlugin.configs["recommended-latest"].rules,
      "react/display-name": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },

  {
    files: ["**/*.{js,jsx}"],
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  eslintConfigPrettier,
];
