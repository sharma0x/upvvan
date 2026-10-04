/* ==========================================================================
   Payload admin layout — root layout for /admin and /api routes.
   Payload manages its own document structure inside this.
   ========================================================================== */
// `@payload-config` is the tsconfig path alias for src/payload.config.ts
// (see tsconfig.json "paths"). It is the documented way to reach the config
// from Next-side files — `@payloadcms/next/config` does not exist.
import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import React from 'react'

import { importMap } from './admin/importMap'

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

type Args = {
  children: React.ReactNode
}

export default function Layout({ children }: Args) {
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  )
}
