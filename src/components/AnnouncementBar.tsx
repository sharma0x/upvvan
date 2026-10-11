import Link from 'next/link'

import { loadBusinessSettings } from '@/lib/settings/server'

/**
 * The announcement strip.
 *
 * ── WHY IT IS A SETTING AND NOT A COMPONENT IN THE HEADER ───────────────────
 *
 * Because the things a business needs to say change on the timescale of a
 * courier, a Diwali, or a stock-out — hourly or daily, not quarterly — and the
 * person who knows is never the person who can deploy.
 *
 * That is the whole argument for `business_settings`: "we are out of ZZ until
 * Thursday" cannot wait for a commit. It is one field, it is editable by the
 * owner, and it takes effect on the next page load.
 *
 * ── WHY IT SAYS ONE THING ───────────────────────────────────────────────────
 *
 * Three announcements stacked read as noise, and a strip nobody reads is worse
 * than no strip: it costs vertical space on every page and buys nothing. One
 * sentence, and the owner has one sentence.
 *
 * Rendered only when `announcementEnabled` is on AND there is text — a switch
 * flipped without content renders nothing rather than an empty coloured bar,
 * which is how a CMS-driven banner usually ends up looking broken.
 */
export default async function AnnouncementBar() {
  const settings = await loadBusinessSettings()

  if (!settings.announcementEnabled || !settings.announcementText) return null

  const hasLink = Boolean(settings.announcementLinkHref && settings.announcementLinkLabel)

  return (
    <div className="bg-brand-soft border-border border-b">
      <p className="text-ink px-base mx-auto flex max-w-[1120px] flex-wrap items-center justify-center gap-2 py-2 text-center text-sm">
        <span>{settings.announcementText}</span>
        {hasLink && (
          <>
            <span aria-hidden="true">·</span>
            <Link
              href={settings.announcementLinkHref!}
              className="text-primary font-semibold underline"
            >
              {settings.announcementLinkLabel}
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
