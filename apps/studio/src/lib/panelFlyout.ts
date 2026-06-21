// panelFlyout — the Shared Islands panel's "open one right-flyout at a time" state machine
// (ADR-0088, the permanent left panel that replaced the on-map building islands).
//
// The panel hosts two kinds of expandable thing: the relocated WorldLegend chips and a
// per-shared-island detail. The owner wants AT MOST ONE open, popping out to the RIGHT of the
// panel as a self-contained box that does NOT reflow the panel's vertical content (the old
// downward-expanding legend drawer would shove everything below it down). This is the pure,
// framework-free reducer behind that contained loop: a single open key (namespaced
// `legend:<row>` / `island:<id>`), toggled closed by the same trigger, switched by a different
// one, and dismissed explicitly (the component wires Escape / click-outside to `close`).
//
// Pure number/string state (no React, no DOM) → unit-testable (panelFlyout.test.ts), Stage-1
// red-green of the behaviour (ADR-0070). The look (where the box sits, its size) is
// owner-attested.

/** Which right-flyout is open, or none. The key is namespaced so legend chips and shared-island
 *  details share the one slot and can never both be open. */
export interface FlyoutState {
  open: string | null;
}

export type FlyoutAction =
  /** Open `key`, or close it if it is already the open one (a clean contained loop). */
  | { type: 'toggle'; key: string }
  /** Dismiss whatever is open (Escape / click-outside). */
  | { type: 'close' };

export const FLYOUT_CLOSED: FlyoutState = { open: null };

/** The single right-flyout reducer — at most one open, never mutating its input. */
export function flyoutReducer(state: FlyoutState, action: FlyoutAction): FlyoutState {
  switch (action.type) {
    case 'toggle':
      return { open: state.open === action.key ? null : action.key };
    case 'close':
      return state.open === null ? state : FLYOUT_CLOSED;
  }
}
