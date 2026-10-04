/**
 * Tailwind v4 CSS-first config types.
 *
 * In v4 the theme lives in CSS (`@theme`), not in a `tailwind.config.ts`, so
 * TypeScript needs this reference to know about the custom tokens and the
 * spacing/radius/label-caps utilities DESIGN.md generates.
 *
 * Without it, `text-label-caps` and `border-border` fail typecheck with
 * "not a known utility" — which would push a developer toward inlining arbitrary
 * values and quietly diverge from the design tokens.
 */
/// <reference types="tailwindcss" />
