'use client'

import type { CSSProperties } from 'react'

type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'light' | 'dark'
  label?: boolean
  style?: CSSProperties
}

const dimensions = {
  sm: { width: 118, height: 38 },
  md: { width: 150, height: 48 },
  lg: { width: 190, height: 60 },
}

export function BrandLogo({ size = 'md', tone = 'light', label = false, style }: BrandLogoProps) {
  const frame = dimensions[size]

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, ...style }}>
      <span
        style={{
          width: frame.width,
          height: frame.height,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: 10,
          background: tone === 'dark' ? 'rgba(255,255,255,0.96)' : '#f8fafc',
          border: tone === 'dark' ? '1px solid rgba(255,255,255,0.24)' : '1px solid #e2e8f0',
        }}
      >
        <img
          src="/logo.png"
          alt="ITspot"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </span>
      {label ? (
        <span style={{ fontSize: 13, fontWeight: 900, color: tone === 'dark' ? '#fff' : '#0f172a' }}>
          ITspot s.r.o.
        </span>
      ) : null}
    </div>
  )
}
