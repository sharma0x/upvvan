/**
 * The provenance band.
 *
 * ── THE CLAIM NO COMPETITOR CAN MAKE ─────────────────────────────────────────
 * Ugaoo has 25 acres in Talegaon and ships nationally. Urvann has 8 urban farms
 * and 500 EV riders across 2 cities. Both lead with SCALE, and both are trying
 * to make distance disappear.
 *
 * We lead with distance. Two acres inside the city we serve means the plant
 * travels 40 minutes in an open basket instead of four days in a box — which is
 * the actual structural reason our damage rate and freight cost are what they
 * are. So this is not a mood statement; it is the reason the promises above it
 * are affordable.
 *
 * The research is explicit that packaging is what makes national plant shipping
 * marginal: a soil-filled pot is billed around the foliage, never the soil, and
 * freight runs 95–105% of product price. Open-EV delivery is what removes that
 * line item entirely — and also what removes the RTO leg that makes a COD return
 * a total write-off.
 *
 * The sequence is deliberate: it explains the guarantee, the delivery promise and
 * the no-COD policy in one pass, so those read as engineering rather than as
 * policy choices the customer is stuck with.
 */
const STEPS = [
  {
    n: '01',
    title: 'Two acres, inside the city',
    body: 'Not a network, not a franchise, not an aggregator. One nursery we own, in the city we deliver to, so the distance from our soil to your window is measured in kilometres rather than states.',
  },
  {
    n: '02',
    title: 'Picked the same morning',
    body: 'Plants are never packed wet — moisture rots roots and couriers reject leaking boxes, which is why every parcel seller must dry stock for two or three days first. In an open basket there is nothing to dry.',
  },
  {
    n: '03',
    title: 'Ridden by our own people',
    body: 'Our riders, our vehicles, no courier box and no shrink wrap. They hand it to you, and they tell you when they are on the way — which is the thing no national site can offer you.',
  },
  {
    n: '04',
    title: 'Reached you, in one piece',
    body: 'No parcel means no transit damage, no volumetric freight bill, and no return leg to pay for. That is why we can guarantee arrival for 48 hours and mean it.',
  },
] as const

export default function Provenance({ cityName }: { cityName: string }) {
  return (
    <section className="px-base pt-3xl mx-auto max-w-[1120px]" aria-labelledby="prov-heading">
      <p className="text-label-caps text-clay m-0">Where your plant actually comes from</p>
      <h2 id="prov-heading" className="mt-xs mb-0">
        Grown forty minutes away. Not shipped to you.
      </h2>
      <p className="text-ink-muted mt-xs mb-lg max-w-[62ch]">
        Almost every plant sold online in India travels four to seven days in a box. Ours does not.
        That single difference is the reason the promises above us are cheap to keep.
      </p>

      <ol className="border-border m-0 grid list-none grid-cols-1 gap-0 rounded-lg border p-0 md:grid-cols-2">
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            className={`p-lg ${i < STEPS.length - 1 ? 'border-border border-b md:border-r' : ''} ${i === 1 ? 'md:border-r-0' : ''}`}
          >
            <p className="text-label-caps text-clay m-0">{s.n}</p>
            <h3 className="mt-xs mb-0 text-[1.05rem] leading-snug font-semibold">{s.title}</h3>
            <p className="text-ink-muted mt-sm mb-0 text-sm">{s.body}</p>
          </li>
        ))}
      </ol>

      <p className="text-ink-muted mt-base mb-0 text-sm">
        We are a single-city shop and we intend to stay that way until the economics say otherwise.
        Every other Indian plant seller grew by adding cities; that is the mistake we would rather
        not copy.
      </p>
      {/* City named once, in the band, not invented into a specific farm address. */}
      <span className="sr-only">Serving {cityName}.</span>
    </section>
  )
}
