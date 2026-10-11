import { formatPaise } from '@/lib/catalogue/pricing'
import type { BusinessSettings } from '@/lib/settings/server'

/**
 * Policy text.
 *
 * ── WHY THIS IS TYPED SOURCE AND NOT CMS CONTENT ────────────────────────────
 *
 * These are the pages that must not be able to disagree with themselves. The
 * audit's sharpest compliance finding is that Ugaoo ships two live,
 * contradictory guarantee policies with no deprecation notice, and a site whose
 * `/policies/shipping` says 14 days while its product page says 30.
 *
 * So the guarantee window is NOT written here. It arrives as a parameter from
 * `price_books.active_guarantee_tier` via `loadPriceBookTerms`, and every policy
 * page interpolates that single value. Change the tier in the database and all
 * seven pages change together; there is no second copy to forget.
 *
 * A CMS would also make these editable by anyone with a staff login, which is
 * the wrong permission for a Legal Metrology declaration or a named grievance
 * officer. A wrong refund policy is a consumer-protection problem; it should take
 * a commit and a review, not a checkbox.
 *
 * ── WHAT IS REQUIRED, AND WHERE ─────────────────────────────────────────────
 *
 * Consumer Protection (E-Commerce) Rules 2020:
 *   r.4(2) — legal entity name, principal address, website name/details, customer
 *             care e-mail AND telephone. Rendered in `SiteFooter` on every page.
 *   r.4(4) — grievance officer's name, contact details and DESIGNATION.
 *   r.4(5) — acknowledgement of a complaint within 48 hours.
 *   r.4(6) — grievance officer response within 48 hours; resolution within 30 days.
 *
 * Legal Metrology (Packaged Commodities) Rules 2011:
 *   r.6(1)  — seven declarations on the listing (rendered on every PDP).
 *   r.6(10) — those declarations must be on the ONLINE listing, not just the pack.
 *   r.6(1)(e) — the retail price shown must be inclusive of all taxes.
 *
 * DPDP Act 2023: consent, purpose limitation, and a named grievance officer for a
 * Data Principal — which is the same person, and stating that explicitly is more
 * useful to a reader than two contact blocks that look like different businesses.
 */
export interface PolicySection {
  id: string
  heading: string
  /** Plain paragraphs. */
  body?: string[]
  /** Bullets, for the mechanical lists that must be complete rather than fluent. */
  points?: string[]
  /** A table, for the parts a reader will scan rather than read. */
  table?: { headers: string[]; rows: string[][] }
}

export interface PolicyDoc {
  slug: string
  title: string
  /** One line for the meta description and the index. */
  standfirst: string
  /**
   * Built from the terms AND the business settings.
   *
   * The second argument exists because four of these documents state the
   * registered entity name, the principal address and the grievance officer —
   * which are r.4(2) and r.4(4) disclosures, and therefore the exact strings an
   * inspection reads.
   *
   * They used to come from `config.compliance`, i.e. the environment. So correcting
   * a misspelt registered address in the admin panel changed the footer and
   * nothing else, while the legal pages — the ones that matter — kept printing the
   * old value until a redeploy with a changed env var.
   */
  sections: (terms: PolicyTerms, settings: BusinessSettings) => PolicySection[]
}

/** The numbers that must come from the price book rather than from a string. */
export interface PolicyTerms {
  tierLabel: string
  tierDays: number
  tierSummary: string
  tierRemedy: string
  arrivalWindowHours: number
  freeDeliveryThresholdPaise: number
  deliveryFeePaise: number
}

function rupees(paise: number): string {
  return formatPaise(paise)
}

// ══════════════════════════════════════════════════════════════════════════
// The guarantee — one canonical page, one number, never contradicted
// ══════════════════════════════════════════════════════════════════════════

export const GUARANTEE: PolicyDoc = {
  slug: 'guarantee',
  title: 'The guarantee',
  standfirst:
    'One window, one remedy, stated in the same words everywhere on this site. If we ever need to change it, this page changes with it.',
  sections: (t) => [
    {
      id: 'the-window',
      heading: `What we promise: ${t.tierLabel}`,
      body: [
        t.tierSummary,
        `This is the only guarantee window we sell. If you find a different number on a page of this site, that page is wrong and we would like to hear about it — send it to the address at the bottom and we will correct it the same day.`,
      ],
    },
    {
      id: 'how',
      heading: 'How a claim works',
      body: [
        `Send us a message on WhatsApp or by e-mail with your order code and a photo of the plant in its pot. That is the whole process. There is no form, no account, no portal and nothing to ship back to us.`,
        'We replace rather than refund a plant, and the reason is worth stating plainly: a plant that has come back to us is a dead plant. Asking you to post it back would cost you a courier fee and cost us a plant we cannot sell. So the plant stays with you and we send another one.',
        `A photo of the pot matters. It is how we identify the plant you actually received rather than one repotted after delivery, and it takes you ten seconds.`,
      ],
      points: [
        'Order code and a photo of the plant, in its pot, in daylight.',
        `Anything about the arrival itself, within ${t.arrivalWindowHours} hours of delivery.`,
        `Anything about the plant dying afterwards, within ${t.tierDays} days of delivery.`,
        'Nothing to post back, ever.',
      ],
    },
    {
      id: 'not-covered',
      heading: 'What is not covered, and why',
      body: [
        'We are as precise about this as we are about the promise, because a guarantee that quietly excludes the common case is not a guarantee.',
      ],
      table: {
        headers: ['Not covered', 'Why', 'What we do instead'],
        rows: [
          [
            'Over- or under-watering',
            'The care spec on every plant page says the interval and the soil-moisture target. A plant kept bone dry or permanently sodden has had its care requirements ignored.',
            'We will tell you how to revive it. A grower answers on WhatsApp, free, and most "dead" plants are recoverable.',
          ],
          [
            'Repotting in the first 30 days',
            'Repotting into a new pot changes the root environment, and a failure that happens then tells us nothing about the plant we sent you.',
            'Tell us before you repot and we will tell you whether to go ahead.',
          ],
          [
            'Wrong light',
            'Every listing states its light requirement before you buy, and the collections are organised by room. A plant that wanted direct sun and got a dim corner was not sold honestly — but it was also described accurately.',
            'Move it. We will help you work out what your room can hold.',
          ],
          [
            'Pests after delivery',
            'We ship pest-free and we inspect every batch. An infestation three weeks later came from somewhere else in the building.',
            'Name the pest on WhatsApp and we will tell you what it is and how to treat it.',
          ],
          [
            'Transit stress',
            'A plant that droops slightly for a day after a journey is not damaged. It is a plant that has been in a box.',
            'Water it, leave it a day in indirect light. It recovers. If it does not, claim.',
          ],
        ],
      },
    },
    {
      id: 'timing',
      heading: 'Why there is a window at all',
      body: [
        'A guarantee with no end date cannot be priced. We grow the replacement before we know whether it is needed, and a guarantee that runs forever means every honest customer subsidises every dishonest one.',
        `So the window is ${t.tierDays} days and it is not negotiable. What we do instead is spend that window telling you what to do, because a plant that survives is worth more to both of us than a second one that does not.`,
      ],
    },
    {
      id: 'cod',
      heading: 'Why there is no cash on delivery',
      body: [
        'A cash-on-delivery return takes 25 to 30 days to reach a Bengaluru nursery, and a plant that has spent a month in a sealed box is unsellable inventory. That is not a risk we would pass on to you, so every order is prepaid.',
        'It also means the replacement decision is easier for you: there is no cash to recover, only a plant to receive.',
      ],
    },
  ],
}

// ══════════════════════════════════════════════════════════════════════════
// Shipping
// ══════════════════════════════════════════════════════════════════════════

export const SHIPPING: PolicyDoc = {
  slug: 'shipping',
  title: 'Shipping & delivery',
  standfirst:
    'Our own riders, in our own city, on the same day. No courier, no box, and no pincode we cannot actually reach.',
  sections: (t) => [
    {
      id: 'how',
      heading: 'How a plant reaches you',
      body: [
        'A plant is cut from the bench and packed the morning it is ordered. One of our own riders carries it to your door the same day. There is no courier and no third-party warehouse in the middle, which is what makes a same-day promise possible in a city with April at 46°C.',
      ],
      points: [
        'Ordered before noon, delivered the same evening.',
        'Ordered after noon, delivered the next evening.',
        'You get a message when it leaves the bench and again when a rider is on the way.',
      ],
    },
    {
      id: 'charge',
      heading: 'What delivery costs',
      body: [
        t.freeDeliveryThresholdPaise > 0
          ? `Delivery is free on orders over ${rupees(t.freeDeliveryThresholdPaise)}, and ${rupees(
              t.deliveryFeePaise,
            )} below that. We would rather publish the number than reveal it at the last step, which is the single most-complained-about thing in this category.`
          : 'Delivery is free on every order, with no minimum. One plant costs exactly what six plants cost us to send, so there is nothing to recover and nothing to invent a threshold for.',
      ],
    },
    {
      id: 'coverage',
      heading: 'Where we deliver',
      body: [
        'Bengaluru only, to a list of serviceable pincodes we maintain and publish. If your pincode is not on it we will say so immediately rather than taking your money and refunding it later — which is what the two largest gifting competitors do.',
        'Check before you spend any time choosing: enter your pincode on the home page or on any plant page. It takes five seconds and it is the same check the database applies when your order is placed.',
      ],
    },
    {
      id: 'not-arrived',
      heading: 'If it does not arrive',
      body: [
        `Tell us within 10 days of the order date and we will resolve it. We do not ask you to wait for a courier to finish its own scan-and-trace cycle, because a courier scan is not a delivery.`,
        'If a rider marks an order delivered and you did not receive it, say so. We investigate it as a delivery failure and we take it seriously, because a delivery we cannot prove is a delivery we will not pretend happened.',
      ],
    },
    {
      id: 'address',
      heading: 'If you are sending it to someone else',
      body: [
        "Put the recipient's address and their mobile number in the delivery fields, not yours. A rider needs to be able to call the person receiving it, and a phone that only you answer will delay the handover rather than speed it up.",
        'We do not leave a live plant unattended, and we do not hand it to a neighbour without that neighbour agreeing. If nobody is available we will call you, and the plant stays at the bench.',
      ],
    },
  ],
}

// ══════════════════════════════════════════════════════════════════════════
// Refunds & replacements
// ══════════════════════════════════════════════════════════════════════════

export const REFUND: PolicyDoc = {
  slug: 'refund',
  title: 'Refunds & replacements',
  standfirst:
    'Two remedies, chosen by what the item is. A plant is replaced; anything else is refunded in money within 24 hours.',
  sections: (t) => [
    {
      id: 'the-rule',
      heading: 'What happens to a plant, and what happens to everything else',
      table: {
        headers: ['What you bought', 'If something is wrong', 'How long you have'],
        rows: [
          [
            'A live plant',
            `We send a replacement. We do not refund a plant, and we will not ask you to send it back. ${t.tierRemedy}`,
            `${t.arrivalWindowHours} hours for arrival problems · ${t.tierDays} days for anything that kills it`,
          ],
          [
            'A pot, soil or feed',
            'We refund you the amount you paid, to the payment method you used.',
            '24 hours from delivery',
          ],
          [
            'A pot you potted a plant into ourselves',
            'We replace the pot, because the plant living in it is now yours and it should keep working. You do not pay to send the old one back.',
            `${t.tierDays} days, same as the plant`,
          ],
        ],
      },
    },
    {
      id: 'how-long',
      heading: 'How long a refund takes',
      body: [
        'We settle it within 24 hours of telling us. The money then takes 3 to 5 working days to appear, which is your bank and not us.',
        'We do not refund a plant because the refund would cost us more than the plant. That is a business decision we have made openly: the marginal cost of a replacement is a plant we have already grown, and a refund on a live plant is money spent and a plant thrown away.',
      ],
    },
    {
      id: 'who-decides',
      heading: 'Who decides',
      body: [
        'A grower, not a script. Every claim is answered by somebody who grows plants, and nobody is compensated for closing claims quickly or denied anything for closing them.',
        'We will occasionally be wrong. If we replace a plant we did not need to, that is our cost and we do not ask you to justify it.',
      ],
    },
  ],
}

// ══════════════════════════════════════════════════════════════════════════
// Privacy
// ══════════════════════════════════════════════════════════════════════════

export const PRIVACY: PolicyDoc = {
  slug: 'privacy',
  title: 'Privacy & the DPDP notice',
  standfirst:
    'We collect what is needed to deliver a plant and answer a message about it. That is a short list, and it is below.',
  sections: (t, settings) => [
    {
      id: 'what-we-hold',
      heading: 'What we hold, and why',
      table: {
        headers: ['What', 'Why', 'How long'],
        rows: [
          [
            'Your name, mobile number and delivery address',
            'To deliver the order to you and to prove we did.',
            'Six years — the period an Indian income-tax record must be retained.',
          ],
          [
            'Your order history',
            'So you can look it up without an account, and so a claim can be verified.',
            'Six years, with the order.',
          ],
          [
            'Your e-mail address, if you give us one',
            'For the order confirmation and the guarantee registration.',
            'Six years, with the order.',
          ],
          [
            'Messages you send us, including photographs',
            'To answer them, and to diagnose what is wrong with a plant.',
            'Two years.',
          ],
          [
            'Aggregated page and order statistics',
            'To know which plants to grow and where.',
            'Indefinitely, in a form that cannot identify you.',
          ],
        ],
      },
    },
    {
      id: 'what-we-do-not',
      heading: 'What we do not do',
      points: [
        'We do not sell your data. Not to anyone, for any price.',
        'We do not add you to a marketing list because you bought something.',
        'We do not write a phone number into a review, ever — there is no field for one.',
        'We do not run a WhatsApp marketing list.',
      ],
    },
    {
      id: 'consent',
      heading: 'Consent, and the WhatsApp number',
      body: [
        'Your mobile number is used for delivery and for messages about your order. That is a service communication and it does not need marketing consent, because it is how the thing you bought reaches you.',
        'If you ask us to message you about other things — the seasonal list, a plant coming back in stock — that is a separate consent and you can withdraw it by replying "stop".',
        `Our Data Protection grievance contact is the same named officer listed in the footer of every page: ${settings.grievanceOfficerName}, ${settings.grievanceOfficerDesignation}, ${settings.grievanceOfficerEmail}.`,
      ],
    },
    {
      id: 'cookies',
      heading: 'Cookies and local storage',
      body: [
        'We store your draft cart in your own browser, not on a server. That means the cart does not follow you to another device, and it means we do not have a file on you saying what you were looking at.',
        'Clearing your browser data empties it. That is the whole privacy cost of the design.',
      ],
    },
  ],
}

// ══════════════════════════════════════════════════════════════════════════
// Terms
// ══════════════════════════════════════════════════════════════════════════

export const TERMS: PolicyDoc = {
  slug: 'terms',
  title: 'Terms of service',
  standfirst: 'The rules of buying from us. Short, because there are not many.',
  sections: (t) => [
    {
      id: 'the-contract',
      heading: 'What you are agreeing to',
      body: [
        `Your order is an offer to buy a live plant at the price shown. We accept it when the payment clears. Prices include GST and are shown in rupees, and the price you see at checkout is the price you pay — we do not add a delivery fee at the last step that was not shown to you.`,
        `Every plant listing carries the seven declarations the Legal Metrology (Packaged Commodities) Rules 2011 require, and they are on the listing rather than only on the packaging, as r.6(10) requires.`,
      ],
    },
    {
      id: 'no-cod',
      heading: 'Prepaid only',
      body: [
        'Every order is prepaid. There is no cash-on-delivery option and there is no setting that enables one. A COD return takes 25 to 30 days, and a plant that has spent that long in a box cannot be sold to anyone, so we do not offer it.',
      ],
    },
    {
      id: 'cancel',
      heading: 'Cancelling',
      body: [
        'You can cancel any time before a rider picks the order up, and the money comes back to the payment method you used. After that the plant is on a bike and the rider has earned their pay, so cancellation becomes a delivery-failure conversation rather than a cancellation.',
        'We do not do partial cancellations on a multi-plant order. Every competitor in this category that offers them regrets it, because a cancelled line means a replacement plant anyway with extra handling.',
      ],
    },
    {
      id: 'our-right',
      heading: 'When we can refuse an order',
      body: [
        'Four reasons, and they are the same four every time: the pincode is outside our coverage, a plant has sold out at the bench, an address we cannot reach safely, or an order that looks like it is not what it claims to be.',
        'When we refuse on the first two, the money comes back in full and immediately. We would rather turn an order away than ship a plant we cannot stand behind.',
      ],
    },
    {
      id: 'liability',
      heading: 'What we are responsible for',
      body: [
        `We are responsible for a plant arriving healthy, for it being what we said it was, and for replacing it inside the guarantee window. ${t.tierRemedy}`,
        'We are not responsible for a plant that dies from being watered wrongly, kept in the wrong light, or left in a draught — and the reason we can say that is that every listing tells you what those three things are for that specific plant.',
        'Nothing in these terms limits your rights under the Consumer Protection Act 2019 or any other law. If you think we have breached something, the grievance officer in the footer is the person to tell, and we acknowledge every complaint within 48 hours.',
      ],
    },
  ],
}

// ══════════════════════════════════════════════════════════════════════════
// Legal notice
// ══════════════════════════════════════════════════════════════════════════

export const LEGAL: PolicyDoc = {
  slug: 'legal',
  title: 'Legal notice',
  standfirst: 'Who we are, where we are, and where a dispute is heard.',
  sections: (t, settings) => [
    {
      id: 'entity',
      heading: 'The entity',
      body: [
        `${settings.legalEntityName}, ${settings.principalAddress}.`,
        'The GSTIN for our Bengaluru operations is printed in the footer of every page and on every tax invoice.',
      ],
    },
    {
      id: 'jurisdiction',
      heading: 'Governing law and jurisdiction',
      body: [
        'These terms are governed by the laws of India. Subject to the consumer forums to which the Consumer Protection Act 2019 gives you access, the courts at Bengaluru, Karnataka have exclusive jurisdiction over any dispute arising from them.',
        'We say that plainly rather than choosing a city we do not operate in, and we note that a consumer forum is available to you regardless of this clause — it is not a waiver of your rights, it is a statement of ours.',
      ],
    },
    {
      id: 'regulatory',
      heading: 'The rules we are subject to',
      points: [
        'Consumer Protection Act 2019',
        'Consumer Protection (E-Commerce) Rules 2020',
        'Legal Metrology (Packaged Commodities) Rules 2011',
        'Digital Personal Data Protection Act 2023',
        'Information Technology Act 2000',
        'The state horticulture nursery registration for the state we operate in — a copy is available on request',
      ],
    },
    {
      id: 'complaints',
      heading: 'Complaints',
      body: [
        `Customer care: ${settings.customerCareEmail}, ${settings.customerCarePhone}.`,
        `Grievance officer, as required by r.4(4) of the E-Commerce Rules: ${settings.grievanceOfficerName}, ${settings.grievanceOfficerDesignation}, ${settings.grievanceOfficerEmail}, ${settings.grievanceOfficerPhone}.`,
        'We acknowledge every complaint within 48 hours and resolve it within 30 days. If a complaint is not resolved in 30 days you are entitled to approach the relevant consumer forum, and we will give you the record.',
      ],
    },
  ],
}

/** Every policy page, in footer order. */
export const POLICIES: readonly PolicyDoc[] = [GUARANTEE, SHIPPING, REFUND, PRIVACY, TERMS, LEGAL]

export function findPolicy(slug: string): PolicyDoc | null {
  return POLICIES.find((p) => p.slug === slug) ?? null
}
