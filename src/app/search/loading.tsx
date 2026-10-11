import { RouteSkeleton } from '@/components/catalogue/GridSkeleton'

/**
 * Shown while this route's data resolves.
 *
 * Without this, navigating to the catalogue is a blank white screen for however
 * long Postgres and the image lookups take — and on a mid-range Android over 4G
 * that is long enough for a shopper to assume the site is broken and leave.
 *
 * It is deliberately the SHAPE of the page rather than a spinner: `RouteSkeleton`
 * lays out the heading, the intro line and a full grid of card-shaped blocks, so
 * when the real page arrives it occupies the same space and nothing jumps. A
 * centred spinner reserves nothing, so the content below it shoves downwards at
 * the exact moment the shopper starts reading.
 *
 * Next shows this on client-side navigation too, which is where it matters most:
 * a click on "All plants" that produces a two-second void reads as a broken link,
 * while a click that produces a skeleton reads as a page loading.
 */
export default function Loading() {
  return <RouteSkeleton />
}
