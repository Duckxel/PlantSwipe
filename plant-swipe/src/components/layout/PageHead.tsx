import React from 'react'
import { usePageMetadata } from '@/hooks/usePageMetadata'

export type PageHeadProps = Parameters<typeof usePageMetadata>[0]

export function PageHead(props: PageHeadProps) {
  usePageMetadata(props)
  return null
}
