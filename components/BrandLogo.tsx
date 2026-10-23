'use client'

import type { CSSProperties } from 'react'

type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'light' | 'dark'
  label?: boolean
  style?: CSSProperties
}

const dimensions = {
  sm: { width: 42, height: 42 },
  md: { width: 58, height: 58 },
  lg: { width: 82, height: 82 },
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
          borderRadius: 8,
          background: '#fff',
          border: tone === 'dark' ? '1px solid rgba(255,255,255,0.24)' : '1px solid #e2e8f0',
        }}
      >
        <img
          src="/delivery-protocol-logo.png"
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
