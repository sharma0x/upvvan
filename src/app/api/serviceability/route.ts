import { NextResponse } from 'next/server'

import { loadGeo } from '@/lib/geo/loader.server'
import { resolveServiceability } from '@/lib/geo/serviceability'

/**
 * GET /api/serviceability?pincode=560001&city=bengaluru
 *
 * The pincode + city gate as an API, which is where the storefront will call it
 * during checkout.
 *
 * This is a READ-ONLY convenience endpoint. It is NOT the enforcement point —
 * order placement re-runs the same pure function server-side against fresh data,
 * and the database refuses an order for an unserviceable pincode regardless. An
 * endpoint that "checks" serviceability is not what stops an order existing.
 *
 * Never leaks another city's name in a rejection message: an over-promising
 * message is worse than none, and a customer in one city must not learn that a
 * neighbouring city serves them.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const pincode = searchParams.get('pincode') ?? ''
  const citySlug = searchParams.get('city') ?? ''

  if (!citySlug) {
    return NextResponse.json(
      { serviceable: false, code: 'UNKNOWN_CITY', message: 'No city specified.' },
      { status: 400 },
    )
  }

  const geo = await loadGeo()
  const cityId = geo.cityIdBySlug.get(citySlug)

  if (cityId === undefined) {
    return NextResponse.json(
      { serviceable: false, code: 'UNKNOWN_CITY', message: 'Unknown city.' },
      { status: 404 },
    )
  }

  const result = resolveServiceability(pincode, {
    cityId: String(cityId),
    pincodes: geo.pincodes,
    cities: geo.cities,
    zones: geo.zones,
  })

  if (!result.serviceable) {
    return NextResponse.json(result, { status: 200 })
  }

  return NextResponse.json({
    serviceable: true,
    pincode: result.pincode.pincode,
    city: result.city.slug,
    cityName: result.city.name,
    zone: result.zone.name,
  })
}
