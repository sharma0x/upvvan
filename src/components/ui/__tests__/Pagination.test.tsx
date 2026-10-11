import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Pagination } from '../Pagination'

describe('Pagination Component', () => {
  it('renders range summary and page size buttons for a single page dataset', () => {
    const html = renderToStaticMarkup(
      <Pagination
        total={8}
        page={1}
        limit={10}
        basePath="/admin-ops/queue"
        nounSingle="order"
        nounPlural="orders"
      />,
    )

    // Range summary
    expect(html).toContain('Showing')
    expect(html).toContain('8')
    expect(html).toContain('orders')

    // Page size buttons 10, 25, 50
    expect(html).toContain('10 items per page')
    expect(html).toContain('25 items per page')
    expect(html).toContain('50 items per page')

    // Single page: no previous or next links
    expect(html).not.toContain('Previous page')
    expect(html).not.toContain('Next page')
  })

  it('renders numbered links and prev/next controls for multi-page datasets', () => {
    const html = renderToStaticMarkup(
      <Pagination
        total={45}
        page={2}
        limit={10}
        basePath="/admin-ops/queue"
        nounSingle="order"
        nounPlural="orders"
      />,
    )

    // Range summary: 11-20 of 45
    expect(html).toContain('11')
    expect(html).toContain('20')
    expect(html).toContain('45')

    // Previous link goes to /admin-ops/queue (page 1)
    expect(html).toContain('aria-label="Previous page"')
    expect(html).toContain('href="/admin-ops/queue"')

    // Next link goes to /admin-ops/queue?page=3
    expect(html).toContain('aria-label="Next page"')
    expect(html).toContain('href="/admin-ops/queue?page=3"')

    // Current page indicator
    expect(html).toContain('aria-current="page"')
  })

  it('preserves extra query parameters when constructing links', () => {
    const html = renderToStaticMarkup(
      <Pagination
        total={30}
        page={1}
        limit={10}
        basePath="/admin-ops/queue"
        extraParams={{ city: 'bengaluru', status: 'unassigned' }}
      />,
    )

    expect(html).toContain('city=bengaluru')
    expect(html).toContain('status=unassigned')
    expect(html).toContain('page=2')
  })

  it('renders ellipsis when total pages exceeds 7', () => {
    const html = renderToStaticMarkup(
      <Pagination
        total={100}
        page={5}
        limit={10}
        basePath="/admin-ops/queue"
      />,
    )

    // Total 10 pages, page 5: should show ellipses
    expect(html).toContain('…')
    expect(html).toContain('aria-label="Page 1"')
    expect(html).toContain('aria-label="Page 10"')
  })

  it('handles limit change URLs properly', () => {
    const html = renderToStaticMarkup(
      <Pagination
        total={100}
        page={1}
        limit={10}
        basePath="/admin-ops/queue"
      />,
    )

    // 25 per page link should have ?limit=25
    expect(html).toContain('href="/admin-ops/queue?limit=25"')
    // 50 per page link should have ?limit=50
    expect(html).toContain('href="/admin-ops/queue?limit=50"')
  })
})
