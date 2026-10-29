// Analyse statique du backend : npm run lint
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    globalIgnores(["dist", "coverage"]),
    {
        files: ["**/*.ts"],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            // Variables volontairement ignorées : préfixe _ (ex. _req, _next)
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            // Les variables d'environnement passent uniquement par src/config/env.ts
            "no-restricted-properties": [
                "error",
                { object: "process", property: "env", message: "Lire les variables via env (src/config/env.ts)." },
            ],
        },
    },
    {
        // Seuls fichiers autorisés à lire process.env
        files: ["src/config/env.ts", "tests/**/*.ts"],
        rules: { "no-restricted-properties": "off" },
    },
    {
        files: ["tests/**/*.ts"],
        languageOptions: {
            globals: { ...globals.node, ...globals.jest },
        },
    },
]);
