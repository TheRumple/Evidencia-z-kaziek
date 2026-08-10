import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ITspot evidencia',
    short_name: 'ITspot',
    description: 'Zákaznícky portál ITspot pre požiadavky a servis.',
    start_url: '/moje-poziadavky',
    scope: '/',
    display: 'standalone',
    background_color: '#08101d',
    theme_color: '#84cc16',
    orientation: 'portrait',
    icons: [
      {
        src: '/app-icon.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon-maskable.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
