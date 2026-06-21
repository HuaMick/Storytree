// panelFlyout — the Shared Islands panel's "open one right-flyout at a time" state machine
// (ADR-0088, the left panel that replaces the on-map building islands). The panel hosts two
// kinds of expandable thing — the relocated WorldLegend chips and a per-shared-island detail —
// and the owner wants AT MOST ONE open, popping out to the RIGHT of the panel without
// reflowing its vertical content. This is the pure, framework-free reducer behind that: a
// single open key (or null), toggled by the same trigger, switched by a different one, and
// dismissed explicitly (Escape / click-outside in the component). Stage-1 red-green of the
// behaviour (ADR-0070); the look (where the box sits, its size) is owner-attested.

import { describe, it, expect } from 'vitest';
import { flyoutReducer, type FlyoutState } from './panelFlyout';

const open = (key: string): FlyoutState => ({ open: key });
const closed: FlyoutState = { open: null };

describe('flyoutReducer — at most one right-flyout open', () => {
  it('opens a section from closed', () => {
    expect(flyoutReducer(closed, { type: 'toggle', key: 'legend:tree' })).toEqual(open('legend:tree'));
  });

  it('toggling the SAME open key closes it (a clean contained loop)', () => {
    expect(flyoutReducer(open('legend:tree'), { type: 'toggle', key: 'legend:tree' })).toEqual(closed);
  });

  it('toggling a DIFFERENT key switches the open flyout (never two at once)', () => {
    const next = flyoutReducer(open('legend:tree'), { type: 'toggle', key: 'island:library' });
    expect(next).toEqual(open('island:library'));
  });

  it('close dismisses whatever is open (Escape / click-outside)', () => {
    expect(flyoutReducer(open('island:library'), { type: 'close' })).toEqual(closed);
  });

  it('close on an already-closed panel is a no-op', () => {
    expect(flyoutReducer(closed, { type: 'close' })).toEqual(closed);
  });

  it('legend chips and shared-island detail share the one slot — opening an island closes a chip', () => {
    // The two expandable kinds compete for the single right-flyout, so a chip and an island
    // detail can never be open together.
    const afterChip = flyoutReducer(closed, { type: 'toggle', key: 'legend:proof' });
    expect(afterChip).toEqual(open('legend:proof'));
    const afterIsland = flyoutReducer(afterChip, { type: 'toggle', key: 'island:library' });
    expect(afterIsland).toEqual(open('island:library'));
    // and back to a chip again
    expect(flyoutReducer(afterIsland, { type: 'toggle', key: 'legend:flora' })).toEqual(
      open('legend:flora'),
    );
  });

  it('is a pure function — the input state is never mutated', () => {
    const start = open('legend:tree');
    const snapshot = { ...start };
    flyoutReducer(start, { type: 'toggle', key: 'island:library' });
    flyoutReducer(start, { type: 'close' });
    expect(start).toEqual(snapshot);
  });
});
