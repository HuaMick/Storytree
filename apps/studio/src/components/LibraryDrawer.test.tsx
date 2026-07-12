// @vitest-environment jsdom
//
// Reconciled for ADR-0187 dec 1 (the library overlay is a PERMANENT LENS). The closed→peek→dive state
// machine of ADR-0185 dec 1 is RETIRED — so this file no longer proves it. The reworked geometry (the
// permanent lens: the flag-gated presence, the retired × / Dive / mode machine, the renamed body slot, and
// the bottom selection-preview `Open` section) is proven in the NET-NEW LibraryPermanentLens.test.tsx
// (capability `library-permanent-lens`, the M1 rework of LibraryDrawer.tsx).
//
// This file is now `library-drawer-shell`'s trimmed real.testFile — it keeps ONLY the still-true, SURVIVING
// contracts: the pure `readLibraryOverlay` reader (the invocation gate ADR-0187 dec 1 preserves) and the
// absent-flag-renders-nothing invariant. Per ADR-0122 (`storytree coverage library-drawer-shell` reads the
// names) each surviving contract id leads a distinctly-named test, so coverage reports 5/5:
//
//   • `?overlay=library` reads true / true with other params / absent reads false / other value reads false
//     (ldw-reads-overlay-flag-present, -present-with-other-params, -absent, -other-value),
//   • absent the flag the shell renders nothing (ldw-closed-without-flag).
//
// RETIRED here (now-false state-machine assertions, moved/removed by the M1 rework):
// lds-flag-opens-drawer-to-peek → re-homed as lpl-flag-gates-permanent-lens;
// lds-peek-overlays-live-map → re-homed as lpl-permanent-lens-over-live-map;
// ldw-peek-reserves-an-empty-slot → re-homed as lpl-body-slot-renders-content;
// lds-esc-and-toggle-close-from-peek, lds-dive-collapses-to-bar-and-reserves-body,
// lds-esc-unwinds-dive-to-peek, ldw-esc-unwinds-peek-to-closed, ldw-close-toggle-clears-overlay-flag
// (all assert the retired × / Dive / Esc-to-closed machine — deleted).
//
// M1 NOTE: `ldw-closed-without-flag` renders the component with the CURRENT `onCommitSearch` prop so it stays
// green at HEAD (removing tests never breaks the survivors). When the M1 rework removes `onCommitSearch` from
// the reworked permanent-lens component, drop it from this one render (`<LibraryDrawer search="" />`) — the
// reworked lens keeps `search` its only required prop, so this stays green against the reworked source.
//
// No backend seam (no `api`, no fetch, no socket, no DB); no agent / drive / model import (the
// modelPathBoundary.test.ts wall stays green).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LibraryDrawer, readLibraryOverlay } from './LibraryDrawer';

afterEach(cleanup);

describe('readLibraryOverlay', () => {
  it('ldw-reads-overlay-flag-present: `?overlay=library` reads true', () => {
    expect(readLibraryOverlay('?overlay=library')).toBe(true);
  });

  it('ldw-reads-overlay-flag-present-with-other-params: true regardless of param order/company', () => {
    expect(readLibraryOverlay('?foo=bar&overlay=library')).toBe(true);
  });

  it('ldw-reads-overlay-flag-absent: no search string reads false', () => {
    expect(readLibraryOverlay('')).toBe(false);
  });

  it('ldw-reads-overlay-flag-other-value: an unrelated/wrong value reads false', () => {
    expect(readLibraryOverlay('?overlay=other')).toBe(false);
  });
});

describe('LibraryDrawer', () => {
  // ── ldw-closed-without-flag ───────────────────────────────────────────────────
  it('ldw-closed-without-flag: absent the flag, the shell renders nothing (the bare map)', () => {
    render(<LibraryDrawer search="" onCommitSearch={vi.fn()} />);
    expect(screen.queryByTestId('library-drawer')).toBeNull();
  });
});
