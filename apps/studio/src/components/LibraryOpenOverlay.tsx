/**
 * LibraryOpenOverlay — the Open document overlay (ADR-0187 dec 2, `library-open-overlay`
 * capability of the library-tech-tree-overlay story).
 *
 * A separate, full-detail artifact view mounted OVER the map as its own container — "like
 * opening a Word doc" — reusing the landed, byte-locked `LibraryDiveBody` router VERBATIM for
 * the body (never a re-authored renderer). Unlike the permanent lens (dec 1, always present,
 * no in-panel close), the Open overlay is TRANSIENT: it exists only while an artifact is open,
 * and a dismiss control invokes `onDismiss` so the glue can clear the open selection.
 *
 * Takes `selection` as a prop — the container proves in isolation, mirroring how
 * `LibraryDiveBody` itself takes its driving data as a prop. Holds no data of its own and makes
 * no fetch of its own (the body's on-demand fetch lives inside `DocView`, already proven at
 * `LibraryDiveBody.test.tsx`).
 */

import { LibraryDiveBody } from './LibraryDiveBody';
import type { SearchResult } from '../lib/librarySearch';

export interface LibraryOpenOverlayProps {
  /** The artifact currently open in the overlay. `null` renders nothing (the closed state). */
  selection: SearchResult | null;
  /** Invoked when the dismiss affordance fires; the caller clears the open selection. */
  onDismiss: () => void;
}

export function LibraryOpenOverlay({
  selection,
  onDismiss,
}: LibraryOpenOverlayProps): React.JSX.Element | null {
  if (selection === null) {
    return null;
  }

  return (
    <div
      className="library-open-overlay"
      data-testid="library-open-overlay"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onDismiss();
        }
      }}
    >
      <button type="button" className="library-open-overlay-close" onClick={onDismiss}>
        Close
      </button>
      <LibraryDiveBody selection={selection} />
    </div>
  );
}
