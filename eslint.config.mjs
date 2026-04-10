import tsparser from "@typescript-eslint/parser";
import tslint from "@typescript-eslint/eslint-plugin"; // Plugin importieren
import obsidianmd from "eslint-plugin-obsidianmd";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
    {
        ignores: ["main.js", "node_modules/", ".obsidian/", "esbuild.config.mjs"],
    },
    {
        files: ["**/*.ts"],
        plugins: {
            "obsidianmd": obsidianmd,
            "@typescript-eslint": tslint,
        },
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            ...obsidianmd.configs.recommended.rules,

            // 1. Die Promise-Prüfung (WICHTIG für Obsidian)
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/await-thenable": "error",

            // 2. Keine unnötigen Assertions (as ...)
            "@typescript-eslint/no-unnecessary-type-assertion": "warn",

            // 3. Strenge gegen 'any'
            "@typescript-eslint/no-explicit-any": "warn",

            // 4. Async Funktionen ohne await finden
            "@typescript-eslint/require-await": "error",

            // 5. CSS & UI Best Practices (Manuelle Regeln)
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "MemberExpression[property.name='style']",
                    "message": "Direct style access is discouraged. Use CSS classes or setCssProps."
                }
            ],

            "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "no-console": "warn",
        },
    }
];
