// Flat config de ESLint (raiz del workspace).
// Linta los archivos .js/.mjs/.cjs; los .ts/.tsx quedan fuera:
// typescript-eslint no soporta TypeScript 7 en versiones estables (ver AGENTS.md > Pendientes).
import js from "@eslint/js";

export default [
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.angular/**"] },
  // En @eslint/js 10.x `configs.recommended` es un objeto unico, no un array.
  js.configs.recommended,
];
