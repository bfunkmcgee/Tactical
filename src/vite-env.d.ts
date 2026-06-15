/// <reference types="vite/client" />

/**
 * Build identity stamp injected by Vite's `define` (see vite.config.ts).
 * Short git hash + build time — rendered on the main menu and the `?debug=1`
 * overlay so an on-device build can be matched against `git rev-parse --short
 * HEAD`, ending "which commit is this phone actually running?" guesswork.
 */
declare const __BUILD_ID__: string;

// Ambient declaration for the one Node builtin vite.config.ts needs (the git
// build stamp). Declared here — a script-context .d.ts — rather than imported
// with @types/node, so tsc doesn't pull Node globals into the app's types.
declare module 'node:child_process' {
  export function execSync(cmd: string): { toString(): string };
}
