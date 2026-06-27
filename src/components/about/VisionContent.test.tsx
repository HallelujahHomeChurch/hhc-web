import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {VisionContent} from './VisionContent';

describe('VisionContent', () => {
  it('renders localized English about content', () => {
    const messages = getMessages('en');

    render(<VisionContent content={messages.about.vision} />);

    expect(screen.getByRole('heading', {name: 'Unity and Mission'})).toBeInTheDocument();
    expect(screen.getByText(/Home Church is built to bring people into unity/)).toBeInTheDocument();
  });
});
