// Weboo — ESLint flat config.
// Lints the actual project sources: the classic browser scripts under
// extension/, the TypeScript unit tests, and tooling.
// Note: extension/ scripts are classic no-bundler browser scripts that rely on
// runtime globals (chrome, HL, window, document, localStorage...), so
// `no-undef` stays off; correctness is guarded by the unit-test suite.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".wxt/**",
      ".output/**",
      "**/node_modules/**",
      // platform / template infrastructure — not project code
      "skills/**",
      "tool-results/**",
      // build output (release zips)
      "dist/**",
      // Next.js build cache of the test fixture (any depth)
      "**/.next/**",
      // Next.js test-fixture app (tests/e2e/fixtures) — framework app code with
      // JSX, exercised by tests/e2e/next-compat-e2e.mjs, not project sources
      "tests/e2e/fixtures/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Classic browser scripts depend on runtime globals
      "no-undef": "off",
      // Pragmatic defaults for this codebase (mirrors the retired Next setup)
      "no-unused-vars": "off",
      "no-console": "off",
      "no-empty": "off",
      "no-irregular-whitespace": "off",
      "no-case-declarations": "off",
      "no-fallthrough": "off",
      "no-redeclare": "off",
      "no-unreachable": "off",
      "no-useless-escape": "off",
      "no-prototype-builtins": "off",
      "no-async-promise-executor": "off",
      // intentional classic-script style: `var self = this` in prototype code
      "no-this-alias": "off",
      "@typescript-eslint/no-this-alias": "off",
      // classic-script style throughout extension/ (TS sources emit that same
      // style — var/const are kept faithful to the original files)
      "no-var": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  {
    /* ── Hardening phase: TS sources play by stricter rules ─────────────
       The legacy classic-script style keeps its exemptions below; the
       TypeScript layer (hand-written + tests) meets the standard rules. */
    files: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx", "entrypoints/**/*.ts", "entrypoints/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }], /* catch(e) with a noop body is the idiom; the error is acknowledged by the comment */
      "no-empty": "error", /* commented catch blocks are the idiom — they pass */
      "no-unreachable": "error",
      "no-useless-escape": "error",
      "no-prototype-builtins": "error",
      "no-fallthrough": "error",
      "no-case-declarations": "error",
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    /* src/shared compiles INTO extension/shared (classic-emit style: var +
       function declarations stay faithful to the shipped form) — narrow,
       documented exemption from the modern-style rules above. */
    files: ["src/shared/**/*.ts"],
    rules: {
      "no-var": "off",
      "prefer-const": "off",
    },
  },
);
