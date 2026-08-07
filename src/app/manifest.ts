import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '哈利路亞家教會',
    short_name: 'HHC',
    description: '哈利路亞家教會官網',
    id: '/',
    start_url: '/zh-Hant',
    scope: '/',
    display: 'standalone',
    background_color: '#fbf5eb',
    theme_color: '#cf685f',
    icons: [
      {src: '/assets/brand/icon-192.png', sizes: '192x192', type: 'image/png'},
      {src: '/assets/brand/logo.png', sizes: '512x512', type: 'image/png'}
    ]
  };
}
