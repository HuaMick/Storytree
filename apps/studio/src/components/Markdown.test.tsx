// @vitest-environment jsdom
//
// The renderer's mermaid wiring (ADR-0095): a ```mermaid fence routes to the diagram component
// (an inline SVG, free of the <pre> code box), while every other fenced block renders exactly as
// before. mermaid itself is mocked — its real client-side render needs a browser layout engine
// and is proven by operator attestation in the studio; here we prove the ROUTING is correct.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('../lib/appData', () => ({ useAppData: () => ({ docIds: new Set<string>() }) }));

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (_id: string, chart: string) => ({ svg: `<svg data-testid="mmd-svg">${chart}</svg>` })),
}));
vi.mock('mermaid', () => ({ default: mermaidMock }));

import { Markdown } from './Markdown';

beforeEach(() => {
  mermaidMock.initialize.mockClear();
  mermaidMock.render.mockClear();
});
afterEach(cleanup);

describe('Markdown — mermaid rendering', () => {
  it('renders a ```mermaid fence as an inline SVG, not a code listing', async () => {
    const { container } = render(<Markdown>{'```mermaid\ngraph TD\n  A --> B\n```'}</Markdown>);

    await waitFor(() => expect(container.querySelector('[data-testid="mmd-svg"]')).toBeTruthy());
    // the diagram host received the SVG …
    expect(container.querySelector('.mermaid-diagram svg')).toBeTruthy();
    // … and it did NOT fall through to a <pre><code class="language-mermaid"> code box
    expect(container.querySelector('pre code.language-mermaid')).toBeNull();
    expect(mermaidMock.render).toHaveBeenCalledTimes(1);
    expect(mermaidMock.render.mock.calls[0]?.[1]).toBe('graph TD\n  A --> B');
  });

  it('leaves a non-mermaid fenced block as a <pre><code> code listing (mermaid never runs)', () => {
    const { container } = render(<Markdown>{'```js\nconsole.log(1)\n```'}</Markdown>);

    const code = container.querySelector('pre code');
    expect(code).toBeTruthy();
    expect(code?.className).toContain('language-js');
    expect(container.querySelector('.mermaid-diagram')).toBeNull();
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it('still renders ordinary prose around a diagram', async () => {
    const { container } = render(
      <Markdown>{'Before.\n\n```mermaid\ngraph TD\n  A --> B\n```\n\nAfter.'}</Markdown>,
    );
    await waitFor(() => expect(container.querySelector('.mermaid-diagram svg')).toBeTruthy());
    expect(screen.getByText('Before.')).toBeTruthy();
    expect(screen.getByText('After.')).toBeTruthy();
  });
});
