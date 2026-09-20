import {ImageResponse} from 'next/og';
import {readFile} from 'node:fs/promises';

export const dynamic = 'force-static';
export const alt = '哈利路亞家教會';
export const size = {
  width: 1200,
  height: 630
};
export const contentType = 'image/png';

export default async function Image() {
  const font = await readFile('src/assets/fonts/klee-one/KleeOne-HHC-OpenGraph.ttf').then((bytes) => Uint8Array.from(bytes).buffer);
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'flex-start',
          background: '#fbf5eb',
          color: '#372d2b',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'center',
          padding: '82px 96px',
          width: '100%'
        }}
      >
        <div style={{background: '#ad493f', borderRadius: 999, height: 14, marginBottom: 44, width: 96}} />
        <div style={{color: '#8f2e22', display: 'flex', fontFamily: 'HHC OG CJK', fontSize: 78, fontWeight: 700, lineHeight: 1.12}}>哈利路亞家教會</div>
        <div style={{color: '#746c67', display: 'flex', fontFamily: 'HHC OG CJK', fontSize: 34, marginTop: 28}}>在愛中建造家庭，在真理中成長</div>
        <div style={{color: '#3a7e7a', display: 'flex', fontSize: 24, fontWeight: 600, marginTop: 72}}>www.alive.org.tw</div>
      </div>
    ),
    { ...size, fonts: [
      {name: 'HHC OG CJK', data: font, style: 'normal', weight: 400},
      {name: 'HHC OG CJK', data: font, style: 'normal', weight: 700}
    ] }
  );
}
