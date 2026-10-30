// Smoke tests for <LivedIconBadge>.
//
// Three behaviors worth pinning:
//   - When `url` is non-null, render an <img> + the violet ring wrapper.
//   - When `url` is null (or empty string), fall back to <LivedIconStrip>.
//   - aria-label on the wrapper names the user's motifs ("your jargon
//     badge — soccer ball, palm tree, book") so screen readers don't see
//     an orphan <img>.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LivedIconBadge } from './lived-icon-badge';

describe('<LivedIconBadge>', () => {
  it('renders an <img> with the badge URL when url is provided', () => {
    render(
      <LivedIconBadge
        url="https://example.supabase.co/storage/v1/object/public/lived-icons/abc.png?t=1"
        motifs={['soccer ball', 'palm tree', 'book']}
      />,
    );
    const wrapper = screen.getByRole('img', {
      name: /your jargon badge.*soccer ball.*palm tree.*book/i,
    });
    expect(wrapper).toBeInTheDocument();
    // The inner <img> is aria-hidden so the wrapper carries the label.
    const innerImg = wrapper.querySelector('img');
    expect(innerImg).not.toBeNull();
    expect(innerImg?.getAttribute('src')).toContain('lived-icons/abc.png');
  });

  it('uses a generic aria-label when motifs are empty', () => {
    render(<LivedIconBadge url="https://example.com/x.png" motifs={[]} />);
    const wrapper = screen.getByRole('img', { name: /^your jargon badge$/i });
    expect(wrapper).toBeInTheDocument();
  });

  it('falls back to LivedIconStrip when url is null', () => {
    render(
      <LivedIconBadge
        url={null}
        fallbackSlugs={['guitar', 'mountains']}
        motifs={[]}
      />,
    );
    // The strip's role="img" with composite "lived icons: ..." label is
    // the renderer when url is null. The badge wrapper (its own role="img"
    // with "your jargon badge" label) MUST NOT appear.
    expect(screen.queryByRole('img', { name: /your jargon badge/i })).toBeNull();
    const stripWrapper = screen.getByRole('img', { name: /lived icons.*guitar.*mountains/i });
    expect(stripWrapper).toBeInTheDocument();
  });

  it('falls back to LivedIconStrip when url is an empty string', () => {
    render(<LivedIconBadge url="" fallbackSlugs={['coffee']} />);
    expect(screen.queryByRole('img', { name: /your jargon badge/i })).toBeNull();
    expect(screen.getByRole('img', { name: /lived icons.*coffee/i })).toBeInTheDocument();
  });

  it('renders nothing visible when both url and fallbackSlugs are empty', () => {
    // Strip returns null on empty slugs; badge never renders without a url.
    // The whole component collapses to nothing — no aria-label, no img.
    const { container } = render(<LivedIconBadge url={null} fallbackSlugs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('respects the size prop on the wrapper box', () => {
    render(
      <LivedIconBadge
        url="https://example.com/x.png"
        motifs={['soccer ball']}
        size={96}
      />,
    );
    const wrapper = screen.getByRole('img', { name: /your jargon badge/i });
    // The size is applied as inline style — we can read it back via
    // getAttribute('style').
    expect(wrapper.getAttribute('style')).toContain('width: 96px');
    expect(wrapper.getAttribute('style')).toContain('height: 96px');
  });
});
