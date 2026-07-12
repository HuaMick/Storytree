/**
 * The Library drawer — now a PERMANENT LENS (ADR-0187 dec 1/2), rebuilt from the ADR-0185
 * closed→peek→dive shell. The retired affordances (the `×` "Close library" button, the "Dive"
 * button, and the closed/peek/dive mode machine) are gone: behind `?overlay=library` the lens
 * simply renders, and there is no other way in or out of it from inside the panel — dismissal (
 * clearing `?overlay`) is owned by the parent glue on map navigation, not this shell.
 *
 * The lens:
 *   - renders nothing unless `readLibraryOverlay(search)` is true (the sole gate);
 *   - carries NO full-screen dimming scrim, so the forest map stays fully live/interactive
 *     beneath it at all times;
 *   - renders a single `bodySlot` (renamed from the retired `peekSlot`; the retired `diveSlot`
 *     is gone — reading a whole artifact is the separate `library-open-overlay` surface, not an
 *     inline dive);
 *   - renders a bottom selection-preview section driven by `selection: SearchResult | null`: a
 *     non-null selection shows its title + category and an "Open" button that fires
 *     `onOpen(selection)`; a null selection shows the empty/prompt state.
 *
 * The palette (forest-cozy, matching `.world-frame`'s `--board-1`/`--board-2`/`--border`/
 * `--accent` variables), the "like opening a Word doc" framing of the sibling Open overlay, and
 * the z-layering are the story's OWNER-ATTESTED UAT leg (ADR-0187 / ADR-0070) — deliberately not
 * asserted here.
 */

import type { SearchResult } from '../lib/librarySearch';

// ---------- the query-flag reader (the worldSettings `?layout=` precedent) ----------

/**
 * Pure reader: does the search string carry `?overlay=library`? Mirrors
 * `readRenderScene`/`readLayoutMode` (`worldSettings.ts` / `TreeView.tsx`) — reads a `?…` param
 * off the search string that precedes the `#hash`, never a new hash route.
 */
export function readLibraryOverlay(search: string): boolean {
  return new URLSearchParams(search).get('overlay') === 'library';
}

// ---------- the permanent lens ----------

export interface LibraryDrawerProps {
  /** The reactive search string (precedes `#hash`) — the lens renders whenever it carries
   *  `?overlay=library`; nothing otherwise. The flag is the ONLY gate — there is no in-panel
   *  transition out of presence. */
  search: string;
  /** What fills the lens body (the finder+subgraph or the whole-corpus overview, composed by the
   *  parent glue — mounted by TreeView where the AppData context is available; the lens itself
   *  stays provider-free so it proves in isolation). Absent → the body renders empty. */
  bodySlot?: React.ReactNode;
  /** The currently-selected artifact, or `null` when nothing is selected — drives the bottom
   *  selection-preview section. Absent is treated as `null` (no selection). */
  selection?: SearchResult | null;
  /** Fired with the current `selection` when the bottom preview's "Open" button is clicked —
   *  the parent glue opens the separate `library-open-overlay` document surface with it. */
  onOpen?: (selection: SearchResult) => void;
  /**
   * @deprecated retired by ADR-0187 dec 1 (the permanent-lens rework superseding ADR-0185's
   * closed→peek→dive shell) — an accepted-but-unused alias of `bodySlot`, kept ONLY so pre-rework
   * call sites (`TreeView.tsx`, updated by a later glue increment) keep compiling. New callers use
   * `bodySlot`.
   */
  peekSlot?: React.ReactNode;
  /**
   * @deprecated retired by ADR-0187 dec 1 — the inline dive slot is gone (reading a whole
   * artifact is the separate `library-open-overlay` surface); accepted-but-ignored only for
   * pre-rework call-site compatibility.
   */
  diveSlot?: React.ReactNode;
  /**
   * @deprecated retired by ADR-0187 dec 1 — in-panel dismissal (the `×`/Esc-to-closed machine) is
   * gone; the parent glue clears `?overlay` on map navigation instead. Accepted-but-ignored only
   * for pre-rework call-site compatibility.
   */
  onCommitSearch?: (nextSearch: string) => void;
}

/**
 * The Library permanent lens — renders behind `?overlay=library` over the still-live map, with a
 * body slot and a bottom selection-preview "Open" section. No mode machine, no close chrome, no
 * dimming scrim.
 */
export function LibraryDrawer({
  search,
  bodySlot,
  peekSlot,
  selection = null,
  onOpen,
}: LibraryDrawerProps) {
  if (!readLibraryOverlay(search)) return null;

  const body = bodySlot ?? peekSlot;

  return (
    <div className="library-drawer" data-testid="library-drawer">
      <div className="library-drawer-body" data-testid="library-drawer-body">
        {body}
      </div>
      <div className="library-drawer-selection-preview" data-testid="library-drawer-selection-preview">
        {selection ? (
          <>
            <div className="library-drawer-selection-summary">
              <span className="library-drawer-selection-title">{selection.title}</span>
              <span className="library-drawer-selection-category">{selection.category}</span>
            </div>
            <button
              type="button"
              className="library-drawer-open"
              onClick={() => onOpen?.(selection)}
            >
              Open
            </button>
          </>
        ) : (
          <div className="library-drawer-selection-empty">Select an artifact to open it.</div>
        )}
      </div>
    </div>
  );
}
