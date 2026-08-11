import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '哈利路亞家教會',
    short_name: 'HHC',
    description: '哈利路亞家教會官網',
    lang: 'zh-Hant',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fbf5eb',
    theme_color: '#cf685f',
    icons: [
      {src: '/assets/brand/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: '/assets/brand/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'}
    ]
  };
}
