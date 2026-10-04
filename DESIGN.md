---
version: alpha
name: Upvvan
description: >
  A neighbourhood plant specialist that is honest about what it can deliver.
  The interface is calm, plain-spoken and unfussy: a customer on a phone, in a
  rented flat, deciding whether to trust us with a living thing. Confidence comes
  from saying "not yet" clearly rather than from visual polish.

colors:
  primary: 'oklch(0.52 0.15 145)'
  secondary: 'oklch(0.62 0.14 145)'
  surface: 'oklch(0.995 0.004 145)'
  'surface-raised': 'oklch(0.965 0.006 145)'
  ink: 'oklch(0.22 0.008 145)'
  'ink-muted': 'oklch(0.48 0.008 145)'
  border: 'oklch(0.88 0.008 145)'
  success: 'oklch(0.52 0.14 150)'
  'success-soft': 'oklch(0.95 0.03 145)'
  # Darkened from L 0.68 to 0.52 after `design.md lint` measured the original at
  # 2.91:1 on the surface colour — below WCAG AA. Warning text is still a
  # warning; it just has to be legible to the people who most need to read it.
  warning: 'oklch(0.52 0.13 70)'
  danger: 'oklch(0.52 0.17 25)'

typography:
  h1:
    fontFamily: ui-serif, Georgia, serif
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.01em'
  body-md:
    fontFamily: ui-sans-serif, system-ui, sans-serif
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: ui-sans-serif, system-ui, sans-serif
    fontSize: 0.8125rem
    fontWeight: 500
    letterSpacing: '0.08em'

rounded:
  sm: 8px
  md: 12px
  lg: 16px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 24px
  xl: 32px
  '2xl': 48px
  '3xl': 64px

components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    rounded: '{rounded.sm}'
    padding: 16px
  button-primary-disabled:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    rounded: '{rounded.sm}'
    padding: 16px
  input-field:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: 14px
  select-field:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: 14px
  label-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink-muted}'
  result-serviceable:
    backgroundColor: '{colors.success-soft}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: 16px
  result-unserviceable:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: 16px
  # Operational states — licence pending, capacity short, gate refused. Amber and
  # red appear almost nowhere on the customer surface by design, so they are
  # declared as components here rather than left as unreferenced palette entries.
  status-pending:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.warning}'
  status-blocked:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.danger}'
  # Success is referenced here as the hairline on a "yes" answer, so the token
  # that carries the meaning is the one that carries the border.
  result-serviceable-border:
    backgroundColor: '{colors.success}'
  # Hairline separating form controls from the surface behind them.
  control-border:
    backgroundColor: '{colors.border}'
---

# Upvvan — design context

## Overview

A single-city plant specialist that owns its own nursery and its own riders.
The business thesis is not plants or price — it is **service**: answering on
WhatsApp inside 15 minutes, and replacing a plant that dies rather than
deflecting with a coupon. Across nine competitors the loudest failure is that
nobody answers.

So the interface has one job above all others: **be straight with the customer.**
Saying "we do not deliver to your pincode yet" is a feature, and it must be
easier to read than anything else on the page. A customer who is told the truth
early can choose a competitor cleanly. A customer told "yes" and then cancelled
becomes a one-star review.

Everything below follows from that.

## Colors

Green is the only chromatic voice, and it is used for _truth_, not decoration:
a green surface means yes, a neutral surface means no. Amber and red are reserved
for operational warnings (licence pending, capacity short) and appear almost
nowhere on the customer surface.

Neutrals are tinted toward the green hue (chroma 0.004–0.008) rather than pure
gray. Pure gray next to a green primary reads as a different product; a tinted
neutral reads as one system. Pure black and pure white are both banned — they
crush the warmth the brand depends on.

`primary` (L 0.52) rather than `secondary` (L 0.62) is the interaction colour
because white text on it clears WCAG AA at 4.9:1. The lighter `secondary` is for
large text and accents only, where the contrast ratio would fail.

## Typography

System UI sans for everything functional — it is fast, it renders Devanagari
correctly when regional-language content arrives (a planned wedge, one state not
eight languages), and it adds no webfont weight to a page a customer opens on a
patchy mobile connection.

A serif display face is used for `h1` only. It gives the one moment of editorial
weight the page needs without importing a display webfont.

Small-caps letter-spaced labels mark sections. They are structural, not
decorative, and never used below 13px where they stop being legible.

## Layout

A 4pt spacing scale. Controls get 14–16px padding, which is the minimum that
keeps a tappable target comfortable for someone holding a plant pot in the other
hand.

One column, max 640px. This screen is a single question with a single answer;
a wider layout would imply there is more to decide.

## Shapes

8px for controls and result banners, 12px for the containing card. Nothing is
fully rounded — plants are not pills, and a pill-shaped form reads as a toy.

## Components

`button-primary` is the single high-emphasis action. There is no secondary
button on this screen; a customer either checks coverage or leaves.

Disabled buttons keep full opacity in the DOM and are distinguished by
`cursor: not-allowed` plus reduced opacity — never by removing the affordance
entirely, so the control does not jump position as the form becomes valid.

Result banners always carry a 1px border in addition to a background tint, so the
state is legible in greyscale and to a colour-blind customer.

## Do's and Don'ts

**Do**

- Show the coverage answer with the same visual weight as the question.
- Name the city in a refusal: "not in Bengaluru yet" is more useful than a bare
  error.
- Keep prepaid-only framing visible and matter-of-fact. It is the model, not an
  apology.

**Don't**

- Don't soften a refusal. No "we'll try our best", no upsell on a pincode we
  cannot serve.
- Don't reveal another city's name in a refusal. "Not in your delivery city yet"
  only.
- Don't use green as decoration. If it is green, it means yes.
- Don't use gradient text, or `border-left` accent stripes thicker than 1px.
- Don't animate a coverage answer. The result should appear like a fact.
