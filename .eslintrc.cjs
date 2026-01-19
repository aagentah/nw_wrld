module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: ["eslint:recommended", "prettier"],
  rules: {
    "no-empty": ["warn", { allowEmptyCatch: true }],
    "no-case-declarations": "off",
    "no-extra-boolean-cast": "warn",
    "no-regex-spaces": "warn",
    "no-prototype-builtins": "off",
    "no-unreachable": "warn",
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: "detect" },
  },
  ignorePatterns: [
    "dist/",
    "release/",
    "build/",
    "node_modules/",
    "src/main/starter_modules/",
  ],
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      extends: ["plugin:@typescript-eslint/recommended", "prettier"],
      rules: {
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
      plugins: ["react", "react-hooks"],
      extends: ["plugin:react/recommended", "plugin:react-hooks/recommended", "prettier"],
      rules: {
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
  ],
};

