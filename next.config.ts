import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

/**
 * Next.js config.
 *
 * `next dev --webpack` / `next build --webpack` (see package.json), NOT Turbopack:
 *
 *  1. Payload's admin build path is webpack-based, and mixing bundlers produces
 *     a subtly broken admin panel rather than a clear error.
 *  2. Turbopack's PostCSS loader resolves plugin names from a sandboxed root and
 *     cannot see `@tailwindcss/postcss`, even when it is installed and resolvable
 *     from Node. Webpack resolves it correctly.
 *
 * `outputFileTracingRoot` is set because this project sits inside a home directory
 * with other projects; without it Next ignores the lockfile and warns.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: import.meta.dirname,
  images: {
    /*
     * `sharp` is already a dependency (Payload needs it for its own image
     * processing) and the catalogue art in `public/images/plants` is local, so
     * there is no remote host to allow. This block exists to pin the formats:
     * AVIF to modern browsers, WebP to everything else.
     */
    formats: ['image/avif', 'image/webp'],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
