/**
 * The not-open-yet state.
 *
 * One component, used by every route that depends on a trading city. A customer
 * who lands on the PDP and gets a different explanation from the one they got on
 * the homepage cannot tell which of the two is true — and "is this site broken"
 * is the question they will actually ask.
 *
 * The wording says WHY rather than apologising. A city appears here once its
 * state horticulture licence is approved and its serviceable pincodes are
 * imported, and both of those are enforced by the database rather than by
 * somebody remembering to flip a flag. That is a fact worth stating: it is the
 * difference between a shop that has not opened and a shop that is broken.
 */
export default function NotOpenYet({
  heading = 'We have not opened here yet',
}: {
  heading?: string
}) {
  return (
    <main id="main" tabIndex={-1} className="px-base py-3xl mx-auto max-w-[640px]">
      <h1 className="my-sm">{heading}</h1>
      <p className="text-ink-muted mt-0">
        A city appears on this site once its state horticulture licence is approved and its
        serviceable pincodes are imported. Both are enforced by the database, not by convention — so
        if you are seeing this, the shop has genuinely not opened here rather than something having
        gone wrong.
      </p>
    </main>
  )
}
