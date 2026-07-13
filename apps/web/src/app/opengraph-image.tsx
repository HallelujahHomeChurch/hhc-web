import {ImageResponse} from 'next/og';

export const dynamic = 'force-static';
export const alt = '哈利路亞家教會';
export const size = {
  width: 1200,
  height: 630
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#fbf5eb',
          color: '#8f2e22',
          display: 'flex',
          fontSize: 82,
          fontWeight: 600,
          height: '100%',
          justifyContent: 'center',
          width: '100%'
        }}
      >
        哈利路亞家教會
      </div>
    ),
    size
  );
}
