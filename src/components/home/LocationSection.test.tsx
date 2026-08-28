import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {LocationSection} from './LocationSection';

describe('LocationSection', () => {
  it('renders the locations and their map links', () => {
    render(<LocationSection
      title="聚會地點"
      mapLabel="Google 地圖"
      items={[
        {id: 'taipei', name: '台北哈利路亞家教會', address: '台北地址', mapHref: 'https://maps.example/taipei'},
        {id: 'zhongli', name: '中壢哈利路亞家教會', address: '中壢地址', mapHref: 'https://maps.example/zhongli'}
      ]}
    />);

    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getAllByRole('link', {name: /Google 地圖/})[0]).toHaveAttribute('href', 'https://maps.example/taipei');
    expect(screen.getByRole('heading', {name: '中壢哈利路亞家教會'})).toBeInTheDocument();
  });
});
