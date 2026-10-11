import type { Metadata } from 'next'
import Link from 'next/link'

import { loadStorefront } from '@/lib/commerce/storefront.server'
import { leadImagesForExcluding } from '@/lib/catalogue/images'
import PlantFinder from '@/components/catalogue/PlantFinder'
import NotOpenYet from '@/components/storefront/NotOpenYet'
import Breadcrumbs from '@/components/seo/Breadcrumbs'

/**
 * The plant finder — `/quiz`.
 *
 * ── WHY THE HEADLINE IS "FOUR QUESTIONS" AND NOT "FIND YOUR PERFECT PLANT" ───
 *
 * "Find your perfect plant" is a promise this catalogue cannot keep. We grow six
 * species, they change with the season, and the honest answer to "which plant" is
 * usually three candidates and a paragraph about the difference. So the page
 * promises four questions and a shortlist, which is what it delivers.
 *
 * The questions themselves are the argument, and they are in
 * `lib/catalogue/plant-finder.ts` with the reasoning attached — air
 * conditioning, window direction, whether you rent, and how reliably you will
 * actually remember to water. Three of those four are asked by nobody in this
 * category, and the rented/owned one is the reason this quiz is worth doing in
 * India at all.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Find your plant — four questions',
    description:
      'Answer four questions about your room and your habits, and we will tell you which plants would actually live there — and which ones would not.',
    alternates: { canonical: '/quiz' },
  }
}

export default async function QuizPage() {
  const storefront = await loadStorefront()
  if (storefront.state === 'no-city') return <NotOpenYet heading="Find your plant" />

  // Art for the result cards, de-duplicated against nothing else on the page.
  const plantFacets = storefront.facets.filter((f) => f.itemClass === 'plant')
  const resolved = leadImagesForExcluding(
    plantFacets.map((f) => f.slug),
    new Set(),
  )
  const images = Object.fromEntries([...resolved].map(([slug, img]) => [slug, img]))

  return (
    <main id="main" tabIndex={-1} className="px-base py-base mx-auto max-w-[760px]">
      <Breadcrumbs trail={[{ href: '/', label: 'Home' }, { label: 'Find your plant' }]} />

      <header className="mt-lg">
        <h1 className="mb-0">Four questions, and we will tell you the answer</h1>
        <p className="text-ink-muted mt-sm mb-0 max-w-[62ch] text-[1.05rem] leading-relaxed">
          Every other plant quiz starts by asking how bright your room is, which is a question
          nobody can answer. This one asks what you actually know about your flat — and it is
          willing to say that nothing we sell suits it, which is more use than a plant that dies in
          a fortnight and a review saying we sold it to you.
        </p>
      </header>

      <div className="mt-2xl">
        <PlantFinder items={plantFacets} images={images} />
      </div>

      {/*
        The fallback, always visible below the quiz. A customer who does not want
        to answer four questions should not have to scroll back up to the
        catalogue — and the ones who do this instead are the ones already
        browsing, so the quiz is a second path and not the only one.
      */}
      <section className="border-border mt-3xl pt-base border-t">
        <h2 className="mt-0 text-[1.1rem]">Or skip it and browse</h2>
        <p className="text-ink-muted mt-xs mb-base">
          Every plant in season, with its light requirement and watering interval stated before you
          buy. Filterable by room, light, difficulty and whether it is safe around a cat.
        </p>
        <p className="gap-base m-0 flex flex-wrap">
          <Link href="/plants" className="text-primary underline">
            Browse all {storefront.facets.length} listings
          </Link>
          <Link href="/collections/plants-for-a-low-light-room" className="text-primary underline">
            Start from a room with no window
          </Link>
          <Link
            href="/collections/plants-that-are-safe-around-cats-and-dogs"
            className="text-primary underline"
          >
            I have a cat
          </Link>
        </p>
      </section>
    </main>
  )
}
