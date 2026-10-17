import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {LoadingBlock, LoadingStatus} from './ContentLoading';

describe('content loading accessibility', () => {
  it('announces one localized status while placeholder blocks stay decorative', () => {
    const {container} = render(<><LoadingStatus label="正在載入"/><div aria-busy="true"><LoadingBlock className="title-line"/><LoadingBlock/></div></>);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('正在載入');
    expect(screen.getByRole('status')).not.toHaveAttribute('aria-busy');
    expect(container.querySelector('[aria-busy]')).not.toContainElement(screen.getByRole('status'));
    expect(container.querySelectorAll('[aria-hidden="true"] .hhc-skeleton')).toHaveLength(2);
    expect(container.querySelector('a,button,input,[tabindex]')).toBeNull();
  });
});
