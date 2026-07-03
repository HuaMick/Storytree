// @vitest-environment jsdom
//
// Stage-1 behaviour test for ReviewEditor (ADR-0146 — the split-pane markdown editor with a
// CriticMarkup toolbar that replaces ReviewBlocks). Pins GEOMETRY/BEHAVIOUR only; the surface's
// APPEARANCE is the story's OWNER-attested UAT leg (ADR-0070) — no visual assertion here. Proved:
//
//   • re-view-mode-is-read-only: View mode renders the prose with NO source textarea.
//   • re-edit-mode-splits-source-and-preview: Edit mode renders the source textarea + a preview.
//   • re-typing-updates-preview: editing the source updates the live preview.
//   • re-toolbar-wraps-selection: an Insert toolbar click wraps the current selection in {++…++}.
//   • re-preview-renders-tracked-change: a {++…++} in the source renders an insertion element
//     in the preview.
//
// api + appData are mocked (no fetch, no DB). Markdown is stubbed to a passthrough so the test
// targets ReviewEditor's own behaviour, not react-markdown.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({ updateAsset: vi.fn() }));
vi.mock('../api', () => ({ api: apiMock }));

vi.mock('../lib/appData', () => ({
  useAppData: () => ({
    me: { role: 'admin', email: 'a@b.c', status: 'active', member: true },
    refreshAssets: vi.fn(),
  }),
}));

vi.mock('./Markdown', () => ({
  Markdown: ({ children }: { children: string }) => <div className="md-stub">{children}</div>,
}));

import { ReviewEditor } from './ReviewEditor';
import { ReviewModeContext } from './ReviewToggle';

const BODY = 'First paragraph.\n\nSecond paragraph.';

const flush = (): Promise<void> => act(async () => {});

function renderEditor(mode: 'view' | 'review', body = BODY) {
  return render(
    <ReviewModeContext.Provider value={mode}>
      <ReviewEditor
        asset={{
          id: 'oq-x',
          category: 'template',
          title: 'T',
          description: 'D',
          body,
          references: [],
        }}
      />
    </ReviewModeContext.Provider>,
  );
}

beforeEach(() => {
  apiMock.updateAsset.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe('ReviewEditor', () => {
  it('re-view-mode-is-read-only: View mode renders prose with no source textarea', () => {
    const { container } = renderEditor('view');
    expect(screen.queryByLabelText('Markdown source')).toBeNull();
    // The body still renders (through the stubbed Markdown) in the read-only view container.
    expect(container.querySelector('.review-view')?.textContent).toContain('First paragraph.');
  });

  it('re-edit-mode-splits-source-and-preview: Edit mode renders the source textarea and a preview', () => {
    renderEditor('review');
    const source = screen.getByLabelText('Markdown source') as HTMLTextAreaElement;
    expect(source).toBeTruthy();
    expect(source.value).toBe(BODY);
    // The preview pane carries a "Preview" label.
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  it('re-typing-updates-preview: editing the source updates the live preview', async () => {
    const { container } = renderEditor('review');
    const source = screen.getByLabelText('Markdown source') as HTMLTextAreaElement;
    fireEvent.change(source, { target: { value: 'A whole new body.' } });
    // The debounced preview catches up.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    // Scope to the preview pane (the textarea also holds the text as its value).
    const preview = container.querySelector('.review-preview-body');
    expect(preview?.textContent).toContain('A whole new body.');
  });

  it('re-toolbar-wraps-selection: an Insert click wraps the selection in {++…++}', async () => {
    renderEditor('review', 'hello world');
    const source = screen.getByLabelText('Markdown source') as HTMLTextAreaElement;
    // Select "hello".
    source.focus();
    source.setSelectionRange(0, 5);
    fireEvent.click(screen.getByTitle('Insert {++ … ++}'));
    await flush();
    expect(source.value).toBe('{++hello++} world');
  });

  it('re-preview-renders-tracked-change: a {++…++} source renders an insertion element', async () => {
    const { container } = renderEditor('review', 'a {++added++} b');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    const ins = container.querySelector('ins.cm-ins');
    expect(ins).toBeTruthy();
    expect(ins?.textContent).toBe('added');
  });

  it('re-preview-renders-deletion: a {--…--} source renders a deletion element', async () => {
    const { container } = renderEditor('review', 'a {--gone--} b');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    const del = container.querySelector('del.cm-del');
    expect(del).toBeTruthy();
    expect(del?.textContent).toBe('gone');
  });
});
