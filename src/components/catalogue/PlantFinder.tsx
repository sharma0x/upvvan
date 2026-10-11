'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { formatPaise } from '@/lib/catalogue/pricing'
import type { Facetable } from '@/lib/catalogue/facets'
import { findCollection } from '@/lib/catalogue/collections'
import { scorePlants, type Airtightness, type QuizAnswers } from '@/lib/catalogue/plant-finder'
import Image from 'next/image'
import type { PlantImage } from '@/lib/catalogue/images'

/**
 * The plant finder, one question at a time.
 *
 * ── WHY ONE QUESTION PER SCREEN ────────────────────────────────────────────
 *
 * A four-question form with radio buttons on one screen looks faster and
 * converts worse. The evidence from every form benchmark is that each additional
 * question on a screen drops completion, and the questions here are the ones a
 * customer has to THINK about — "how reliably will you remember to water" is a
 * moment of honesty that a wall of radio buttons makes easy to skip.
 *
 * So: one question, the answer buttons large enough to hit on a phone, and a
 * Back link. A customer who changes their mind at question two is not lost; they
 * are one click back.
 *
 * ── WHY IT IS CLIENT-SIDE ───────────────────────────────────────────────────
 * The scoring is a pure function (`scorePlants`), unit-tested in
 * `plant-finder.test.ts` with no DOM. Running it in the browser means the answer
 * appears in one frame with no round trip, on the connections this business
 * sells over. The catalogue is passed in as a prop, so the scoring still runs on
 * data the server loaded — the client is not fetching anything.
 *
 * The URL carries the answers so the result is shareable and back-button safe.
 * Four short keys, not JSON: a shared link that reads `?q=ac:1,win:n,t:r,rel:f`
 * is one a person can read out loud on the phone.
 */
interface Props {
  items: Facetable[]
  /** slug → resolved art, so the quiz shows the same photograph the card does. */
  images: Record<string, PlantImage>
}

interface Option {
  key: string
  label: string
  detail: string
}

const Q1: Option[] = [
  {
    key: 'yes',
    label: 'Yes, and it runs most of the day',
    detail:
      '18–22°C and dry, sixteen hours a day. This is the single most useful fact about your room.',
  },
  {
    key: 'no',
    label: 'No AC, or it is only on at night',
    detail: 'Warmer and more humid, which most indoor plants actually prefer.',
  },
]

const Q2: Option[] = [
  {
    key: 'windowless',
    label: 'No window at all',
    detail: 'A windowless bedroom or a bathroom. Genuinely common in a rented Indian flat.',
  },
  {
    key: 'north',
    label: 'North-facing window',
    detail: 'Bright all day, but never any direct sun.',
  },
  { key: 'east', label: 'East-facing window', detail: 'Gentle morning sun, shade by afternoon.' },
  {
    key: 'west_south',
    label: 'West or south window',
    detail: 'Hours of hard afternoon sun — the brightest room in a Bengaluru flat.',
  },
  {
    key: 'outdoor',
    label: 'A balcony, terrace or courtyard',
    detail: 'Full sun and real weather. A different category entirely.',
  },
]

const Q3: Option[] = [
  {
    key: 'rented',
    label: 'Rented',
    detail: 'Nothing on the walls, nothing heavy, and everything comes with you when you move.',
  },
  {
    key: 'owned',
    label: 'Owned or a family flat',
    detail: 'You can put something on a ledge, and you can forget about it for a fortnight.',
  },
]

const Q4: Option[] = [
  {
    key: 'fortnight',
    label: 'Honestly, I forget for a fortnight',
    detail:
      'Then you want a plant that survives a missed watering. Most people answer this one truthfully.',
  },
  {
    key: 'weekly',
    label: 'Roughly weekly if I set a reminder',
    detail: 'A steady rhythm suits most things.',
  },
  {
    key: 'daily',
    label: 'Every day, I would enjoy doing it',
    detail: 'You can grow things that most people cannot keep alive.',
  },
]

const STEPS: Array<{ key: keyof QuizAnswers; question: string; why: string; options: Option[] }> = [
  {
    key: 'airConditioned',
    question: 'Is the room you want the plant in air-conditioned?',
    why: 'Nobody needs a lux meter to know whether their flat has an AC, and conditioned air for sixteen hours a day is the fact that decides more plants than light does.',
    options: Q1,
  },
  {
    key: 'window',
    question: 'Which way does the window face?',
    why: 'In India, direction is the honest proxy for light. A west window gets hours of sun; a north window gets bright shade and no sun at all.',
    options: Q2,
  },
  {
    key: 'tenure',
    question: 'Do you rent the place?',
    why: 'This is the question nobody in India asks, and it rules out more plants than light does. In a rented flat you cannot hang anything, fix anything, or leave anything large on a ledge.',
    options: Q3,
  },
  {
    key: 'reliability',
    question: 'How reliably will you remember to water?',
    why: 'Not how often you intend to — how reliably you will. There is no wrong answer, and the honest one gets you a plant that will actually be alive in a year.',
    options: Q4,
  },
]

function toAnswers(values: Partial<Record<string, string>>): QuizAnswers | null {
  const ac = values.ac
  const win = values.win as Airtightness | undefined
  const ten = values.ten
  const rel = values.rel
  if (!ac || !win || !ten || !rel) return null

  return {
    airConditioned: ac === 'yes',
    window: win,
    tenure: ten === 'rented' ? 'rented' : 'owned',
    reliability: rel === 'fortnight' ? 'fortnight' : rel === 'weekly' ? 'weekly' : 'daily',
  }
}

/** `answers` → the four short keys. The single place the URL is defined. */
function toParams(answers: Partial<QuizAnswers>): Record<string, string> {
  return {
    ...(answers.airConditioned != null ? { ac: answers.airConditioned ? 'yes' : 'no' } : {}),
    ...(answers.window ? { win: answers.window } : {}),
    ...(answers.tenure ? { ten: answers.tenure } : {}),
    ...(answers.reliability ? { rel: answers.reliability } : {}),
  }
}

/**
 * Compact, readable, shareable: `?q=ac:yes,win:north,ten:rented,rel:fortnight`.
 *
 * Four short keys rather than JSON, because a link a person can read out loud on
 * the phone is a link that gets sent.
 */
function toQuery(answers: Partial<QuizAnswers>): string {
  return Object.entries(toParams(answers))
    .map(([k, v]) => `${k}:${v}`)
    .join(',')
}

/** Read answers out of the URL. Runs on the server too, hence the guard. */
function readAnswersFromUrl(): Partial<QuizAnswers> {
  if (typeof window === 'undefined') return {}
  const raw = new URLSearchParams(window.location.search).get('q')
  if (!raw) return {}
  const out: Record<string, string> = {}
  for (const pair of raw.split(',')) {
    const [k, v] = pair.split(':')
    if (k && v) out[k] = v
  }
  return {
    ...(out.ac === 'yes' || out.ac === 'no' ? { airConditioned: out.ac === 'yes' } : {}),
    ...(out.win ? { window: out.win as Airtightness } : {}),
    ...(out.ten === 'rented' || out.ten === 'owned' ? { tenure: out.ten } : {}),
    ...(out.rel && ['fortnight', 'weekly', 'daily'].includes(out.rel)
      ? { reliability: out.rel as 'fortnight' | 'weekly' | 'daily' }
      : {}),
  }
}

export default function PlantFinder({ items, images }: Props) {
  /*
   * ONE piece of state, and the URL is derived from it.
   *
   * The first version kept `answers` for rendering and a parallel `params`
   * object for the score, and they could disagree — which is the classic way a
   * quiz shows a question the customer has answered and then scores it as
   * unanswered. `answers` is the only state; `complete` is derived; the URL is
   * written as a side effect of answering.
   */
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>(readAnswersFromUrl)
  const [step, setStep] = useState(0)

  const complete = useMemo(() => toAnswers(toParams(answers)), [answers])
  const result = useMemo(() => (complete ? scorePlants(complete, items) : null), [complete, items])

  /**
   * Record an answer and move on.
   *
   * The URL is updated with `replaceState` rather than a navigation so Back
   * returns the customer to wherever they were before the quiz rather than
   * stepping through four history entries. A quiz that traps a customer in four
   * Back presses loses them.
   */
  function answer(stepKey: keyof QuizAnswers, optionKey: string) {
    const value =
      stepKey === 'airConditioned'
        ? optionKey === 'yes'
        : stepKey === 'window'
          ? (optionKey as Airtightness)
          : stepKey === 'tenure'
            ? (optionKey as 'rented' | 'owned')
            : (optionKey as 'fortnight' | 'weekly' | 'daily')

    const nextAnswers = { ...answers, [stepKey]: value }
    setAnswers(nextAnswers)
    setStep((s) => s + 1)

    if (typeof window !== 'undefined') {
      const qs = toQuery(nextAnswers)
      window.history.replaceState(null, '', qs ? `/quiz?q=${encodeURIComponent(qs)}` : '/quiz')
    }
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1))
  }

  function restart() {
    setAnswers({})
    setStep(0)
    if (typeof window !== 'undefined') window.history.replaceState(null, '', '/quiz')
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div>
        <div className="border-border bg-surface-raised p-lg rounded-md border">
          <h2 className="mt-0">Your shortlist</h2>
          <p className="mb-sm">{result.verdict}</p>
          <button
            type="button"
            onClick={restart}
            className="border-border hover:bg-brand-soft min-h-[44px] cursor-pointer rounded-sm border px-3 text-sm"
          >
            Answer differently
          </button>
        </div>

        {!result.honest && (
          <div className="border-warning bg-surface-raised mt-lg p-lg rounded-md border">
            <h3 className="mt-0">We would rather tell you this than sell you something</h3>
            <p className="mb-0">
              Nothing we sell suits a room with no window and no reminder you will keep. That is a
              real answer, not a failure of the catalogue. Two things fix it: a cheap grow light,
              which changes the light question completely, or a plant you water on a schedule rather
              than by eye.{' '}
              <a href="/contact" className="text-primary underline">
                Ask us about a grow light
              </a>{' '}
              and we will cost you one out honestly, including the ones we would not make money on.
            </p>
          </div>
        )}

        {result.matches.length > 0 && (
          <ul className="mt-lg gap-base m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2">
            {result.matches.map((match) => (
              <li key={match.item.id}>
                <article className="border-border bg-surface-card flex h-full flex-col overflow-hidden rounded-md border">
                  <div className="border-border bg-surface-raised relative aspect-[4/3] w-full shrink-0 border-b">
                    {images[match.item.slug] ? (
                      <Image
                        src={images[match.item.slug]!.src}
                        alt={match.item.commonName}
                        fill
                        sizes="(max-width: 640px) 100vw, 420px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-ink-muted px-base absolute inset-0 flex items-center justify-center text-center">
                        {match.item.commonName}
                      </span>
                    )}
                  </div>
                  <div className="p-base flex flex-1 flex-col">
                    <span className="text-label-caps text-clay block">
                      {match.item.sizeTier} · {match.item.light.replace('_', ' ')}
                    </span>
                    <span className="mt-xs block text-[1.1rem] font-semibold">
                      {match.item.commonName}
                    </span>
                    <span className="text-ink-muted mt-xs block text-sm italic">
                      {match.item.botanicalName}
                    </span>

                    <span className="mt-sm block text-sm">
                      <strong>Why this one:</strong> {match.reason}.
                    </span>

                    {match.caveat && (
                      <span className="text-clay mt-xs block text-sm">
                        <strong>Before you buy:</strong> {match.caveat}.
                      </span>
                    )}

                    <span className="pt-base mt-auto block font-semibold">
                      {formatPaise(match.item.entryPaise)}
                    </span>
                    <Link
                      href={`/plant/${match.item.slug}?tier=${match.item.sizeTier}`}
                      className="bg-primary text-surface mt-sm inline-flex min-h-[44px] items-center justify-center rounded-sm px-3 no-underline"
                    >
                      See this plant
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        {result.suggestedCollections.length > 0 && (
          <section className="mt-3xl">
            <h2 className="mt-0">Pages that go deeper on this</h2>
            <p className="text-ink-muted mt-xs mb-base max-w-[62ch]">
              These are articles rather than filters — they explain why, which is the half of the
              decision a checkbox cannot do.
            </p>
            <ul className="gap-sm m-0 flex list-none flex-col p-0">
              {result.suggestedCollections.map((slug) => {
                const def = findCollection(slug)
                if (!def) return null
                return (
                  <li key={slug}>
                    <Link
                      href={`/collections/${slug}`}
                      className="border-border bg-surface-card hover:border-clay p-base text-ink block rounded-md border no-underline"
                    >
                      <span className="block font-semibold">{def.label}</span>
                      <span className="text-ink-muted mt-xs block text-sm">{def.headline}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    )
  }

  // ── QUESTION ──────────────────────────────────────────────────────────────
  const current = STEPS[step]!
  const chosen = (() => {
    const v = answers[current.key]
    if (v == null) return null
    if (current.key === 'airConditioned') return v ? 'yes' : 'no'
    return v
  })()

  return (
    <div>
      <p className="text-label-caps text-clay m-0">
        Question {step + 1} of {STEPS.length}
      </p>

      {/*
        A progress bar as an ordered list of steps rather than a div, so a screen
        reader hears "step 2 of 4" instead of a percentage. It is also a
        progress INDICATOR, so it must not be the only way the step number is
        conveyed — hence the text above it, which is why both exist.
      */}
      <ol className="border-border mt-sm gap-xs m-0 flex list-none p-0" aria-hidden="true">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-border'}`}
          />
        ))}
      </ol>

      <h2 className="mt-xl mb-0 max-w-[22ch]">{current.question}</h2>
      <p className="text-ink-muted mt-sm max-w-[62ch]">{current.why}</p>

      {/*
        The buttons are `min-h-[56px]`, not 44. These are the only interactive
        elements on the page and they are the whole conversion path, so they get
        more than the accessibility floor — a thumb mis-hitting here loses the
        customer, and re-asking question two to a someone who thinks they
        already answered is the fastest way to lose them.
      */}
      <ul className="mt-lg gap-sm m-0 flex list-none flex-col p-0">
        {current.options.map((option) => {
          const active = chosen === option.key
          return (
            <li key={option.key}>
              <button
                type="button"
                onClick={() => answer(current.key, option.key)}
                aria-pressed={active}
                className={`p-base min-h-[56px] w-full cursor-pointer rounded-md border text-left ${
                  active ? 'border-primary bg-brand-soft' : 'border-border hover:border-primary'
                }`}
              >
                <span className="block font-semibold">{option.label}</span>
                <span className="text-ink-muted mt-xs block text-sm">{option.detail}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {step > 0 && (
        <button
          type="button"
          onClick={goBack}
          className="text-primary mt-lg min-h-[44px] cursor-pointer underline"
        >
          ← Back to question {step}
        </button>
      )}

      {/*
        The full question list as a <details>, for a customer who would rather
        read all four then answer than be walked through them. Both routes reach
        the same shortlist.
      */}
      <details className="border-border text-ink-muted mt-3xl p-base rounded-md border text-sm">
        <summary className="cursor-pointer font-semibold">
          Show me all four questions at once
        </summary>
        <ol className="mt-sm gap-sm mb-0 flex list-none flex-col p-0">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <strong className="text-ink">
                {i + 1}. {s.question}
              </strong>
              <span className="block">{s.why}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}
