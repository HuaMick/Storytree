// @vitest-environment jsdom
//
// The Library overlay as a PERMANENT LENS (ADR-0187 dec 1/2, capability `library-permanent-lens`,
// the M1 rework of `LibraryDrawer.tsx`). This is the net-new real.testFile for this capability —
// it pins the reworked shell's behaviour as a WHOLE, spanning:
//
//   • lpl-flag-gates-permanent-lens        — the `?overlay=library` flag alone gates presence; no
//                                            mode machine, no other way in or out from inside the
//                                            lens.
//   • lpl-no-closed-or-dive-mode-no-close-button — the retired `×`/"Close library" button, the
//                                            "Dive" button, and the `closed`/`dive` mode states are
//                                            GONE.
//   • lpl-permanent-lens-over-live-map     — the lens renders no full-screen dimming scrim; the map
//                                            stays live beneath it (proven by the scrim's absence).
//   • lpl-body-slot-renders-content        — the renamed `bodySlot` prop (was `peekSlot`) renders
//                                            whatever node it is handed; the retired `diveSlot` is
//                                            gone.
//   • lpl-bottom-selection-preview-open-fires-onopen — a bottom selection-preview section driven by
//                                            a `selection: SearchResult | null` prop: non-null shows
//                                            the selection's title + kind and an enabled "Open"
//                                            button that fires `onOpen(selection)`; null shows the
//                                            empty/prompt state with no enabled Open button.
//
// The `readLibraryOverlay` reader and the absent-flag-renders-nothing invariant are unchanged and
// stay pinned in the trimmed `LibraryDrawer.test.tsx` (`ldw-*`) — not re-pinned here.
//
// `onCommitSearch`/`peekSlot`/`diveSlot` are the RETIRED shell's props (ADR-0185 dec 1) — the
// permanent lens drops `onCommitSearch` entirely (in-panel dismissal is retired; the parent glue
// clears `?overlay` on map navigation, not this shell) and renames `peekSlot` to `bodySlot`. This
// file exercises the reworked prop surface (`search`, `bodySlot`, `selection`, `onOpen`) and is
// expected to be RED against the current (pre-rework) `LibraryDrawer.tsx`.
//
// No backend seam (no `api`, no fetch, no socket, no DB); no agent / drive / model import (the
// modelPathBoundary.test.ts wall stays green). Appearance (palette, chrome) is NOT asserted here —
// owner-attested per ADR-0187/ADR-0070.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LibraryDrawer } from './LibraryDrawer';
import type { SearchResult } from '../lib/librarySearch';

afterEach(cleanup);

const selection: SearchResult = {
  id: 'asset-cozy-forest-palette',
  title: 'Cozy Forest Palette',
  category: 'principle',
  source: 'asset',
};

describe('LibraryDrawer — permanent lens (ADR-0187 dec 1/2)', () => {
  it('lpl-flag-gates-permanent-lens: the flag alone gates presence — true renders the lens, absent renders nothing', () => {
    render(<LibraryDrawer search="?overlay=library" selection={null} onOpen={vi.fn()} />);
    expect(screen.getByTestId('library-drawer')).not.toBeNull();
    cleanup();

    render(<LibraryDrawer search="" selection={null} onOpen={vi.fn()} />);
    expect(screen.queryByTestId('library-drawer')).toBeNull();
  });

  it('lpl-no-closed-or-dive-mode-no-close-button: the retired close/dive affordances and mode machine are gone', () => {
    render(<LibraryDrawer search="?overlay=library" selection={null} onOpen={vi.fn()} />);

    expect(screen.queryByLabelText('Close library')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close library' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dive' })).toBeNull();

    const lens = screen.getByTestId('library-drawer');
    expect(lens.getAttribute('data-mode')).not.toBe('closed');
    expect(lens.getAttribute('data-mode')).not.toBe('dive');
  });

  it('lpl-permanent-lens-over-live-map: no full-screen dimming scrim renders over the map', () => {
    render(<LibraryDrawer search="?overlay=library" selection={null} onOpen={vi.fn()} />);

    expect(document.querySelector('.library-drawer-scrim')).toBeNull();
    expect(screen.queryByTestId('library-drawer-scrim')).toBeNull();
  });

  it('lpl-body-slot-renders-content: the bodySlot prop renders whatever node it is handed, and there is no dive slot', () => {
    render(
      <LibraryDrawer
        search="?overlay=library"
        selection={null}
        onOpen={vi.fn()}
        bodySlot={<div data-testid="stub-body-slot-content">stub body content</div>}
      />,
    );

    expect(screen.getByTestId('stub-body-slot-content').textContent).toBe('stub body content');
    expect(screen.queryByTestId('library-drawer-dive-slot')).toBeNull();
  });

  describe('lpl-bottom-selection-preview-open-fires-onopen', () => {
    it('a non-null selection renders its title + kind and an enabled "Open" button that fires onOpen with the selection', () => {
      const onOpen = vi.fn();
      render(<LibraryDrawer search="?overlay=library" selection={selection} onOpen={onOpen} />);

      expect(screen.getByText(selection.title)).not.toBeNull();
      expect(screen.getByText(selection.category)).not.toBeNull();

      const openButton = screen.getByRole('button', { name: 'Open' });
      expect(openButton.hasAttribute('disabled')).toBe(false);

      fireEvent.click(openButton);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen).toHaveBeenCalledWith(selection);
    });

    it('a null selection renders the empty/prompt state with no enabled Open button', () => {
      const onOpen = vi.fn();
      render(<LibraryDrawer search="?overlay=library" selection={null} onOpen={onOpen} />);

      const openButton = screen.queryByRole('button', { name: 'Open' });
      expect(openButton === null || openButton.hasAttribute('disabled')).toBe(true);
      expect(onOpen).not.toHaveBeenCalled();
    });
  });
});
