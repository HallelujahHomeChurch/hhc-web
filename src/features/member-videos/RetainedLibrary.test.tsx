import {fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';
import {expect, it} from 'vitest';
import {RetainedLibrary} from './RetainedLibrary';

it('retains one real list and its state across the route slot and inert gesture backdrop', () => {
  const slot = document.createElement('div'); document.body.append(slot);
  function List({active}: {active: boolean}) {
    const [count, setCount] = useState(0);
    return <button data-active={String(active)} onClick={() => setCount(count + 1)}>Loaded pages {count}</button>;
  }
  const surface = {key: 'member:search', render: (active: boolean) => <List active={active}/>};
  const view = render(<RetainedLibrary surface={surface} slot={slot} visible={false} scroll={80}/>);
  const list = screen.getByRole('button', {name: 'Loaded pages 0'});
  fireEvent.click(list);
  view.rerender(<RetainedLibrary surface={surface} slot={null} visible scroll={80}/>);
  expect(document.querySelectorAll('button')).toHaveLength(1);
  expect(list).toHaveTextContent('Loaded pages 1');
  expect(list).toHaveAttribute('data-active', 'false');
  expect(list.closest('[inert]')).not.toBeNull();
  view.rerender(<RetainedLibrary surface={surface} slot={slot} visible={false} scroll={80}/>);
  expect(screen.getByRole('button', {name: 'Loaded pages 1'})).toBe(list);
  expect(list).toHaveAttribute('data-active', 'true');
  view.rerender(<RetainedLibrary surface={null} slot={null} visible={false} scroll={0}/>);
  expect(document.querySelector('button')).toBeNull();
  view.unmount(); slot.remove();
});
