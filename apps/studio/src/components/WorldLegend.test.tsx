// @vitest-environment jsdom
//
// The legend bar is ADAPTIVE (one entry per world model, fans expose the full
// vocabulary): these tests pin the grounding rules — which entries appear for
// an offline frontmatter-only world vs a live one with verdicts/sessions, that
// absent states render dimmed as "not in world yet", and that the status fan
// drives the same hidden-status filter the old toolbar chips did.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WorldLegend, legendFacts } from './WorldLegend';
import type { TreeCapability, TreeSession, TreeStory, WorkStatus } from '../types';

const cap = (
  id: string,
  status: WorkStatus | null,
  extra: Partial<TreeCapability> = {},
): TreeCapability => ({
  id,
  title: id,
  outcome: '',
  status,
  proofMode: 'red-green',
  dependsOn: [],
  ...extra,
});

const story = (
  id: string,
  status: WorkStatus | null,
  capabilities: TreeCapability[],
  extra: Partial<TreeStory> = {},
): TreeStory => ({
  id,
  title: id,
  outcome: '',
  status,
  proofMode: 'UAT',
  dependsOn: [],
  capabilities,
  ...extra,
});

const session = (id: string, band: TreeSession['band']): TreeSession => ({
  sessionId: id,
  branch: 'claude/x',
  workingOn: 'gardening',
  nodes: [],
  band,
  lastSeenAt: '2026-06-12T00:00:00.000Z',
});

/** Today's corpus shape: proposed+mapped only, one sapling, no verdicts. */
const offlineWorld = (): TreeStory[] => [
  story('library', 'mapped', [cap('library-cli', 'mapped'), cap('seed-corpus', 'proposed')]),
  story('drive-machinery', 'proposed', []),
  story('studio', 'proposed', [cap('read-corpus', 'proposed')], {
    dependsOn: ['library'],
  }),
];

const noop = (): void => {};
const renderLegend = (
  stories: TreeStory[],
  sessions: TreeSession[] = [],
  over: Partial<Parameters<typeof WorldLegend>[0]> = {},
) =>
  render(
    <WorldLegend
      stories={stories}
      sessions={sessions}
      hidden={new Set()}
      onToggleStatus={noop}
      onResetHidden={noop}
      {...over}
    />,
  );

afterEach(cleanup);

describe('legendFacts', () => {
  it('grounds the legend in the loaded world', () => {
    const facts = legendFacts(offlineWorld(), [session('s1', 'fresh')]);
    expect(facts.statusTotals.get('proposed')).toEqual({ stories: 2, caps: 2 });
    expect(facts.statusTotals.get('mapped')).toEqual({ stories: 1, caps: 1 });
    expect(facts.saplingPresent).toBe(true);
    expect(facts.capPass || facts.capFail || facts.signPass || facts.signFail).toBe(false);
    expect(facts.anyUnproven).toBe(true);
    expect(facts.anyDeadFlora).toBe(false);
    expect([...facts.bands]).toEqual(['fresh']);
  });

  it('a signed ✗ withers flora even when the authored status is fine', () => {
    const facts = legendFacts(
      [story('s', 'mapped', [cap('c', 'mapped', { verdict: { outcome: 'fail', at: 'now' } })])],
      [],
    );
    expect(facts.anyDeadFlora).toBe(true);
    expect(facts.capFail).toBe(true);
  });

  it('status unhealthy withers flora with no verdict at all (the offline arm)', () => {
    const facts = legendFacts([story('s', 'mapped', [cap('c', 'unhealthy')])], []);
    expect(facts.anyDeadFlora).toBe(true);
    expect(facts.capFail).toBe(false);
  });

  it('a story UAT verdict is a signpost fact, never a capability-badge fact', () => {
    const facts = legendFacts(
      [story('s', 'mapped', [cap('c', 'mapped')], { verdict: { outcome: 'fail', at: 'now' } })],
      [],
    );
    expect(facts.signFail).toBe(true);
    expect(facts.capPass || facts.capFail).toBe(false);
  });

  it('an unhealthy zero-cap story is NOT a sapling (it withers instead)', () => {
    // retired never reaches the legend — presentStories prunes it (ADR-0038)
    expect(legendFacts([story('s', 'unhealthy', [])], []).saplingPresent).toBe(false);
    expect(legendFacts([story('s', 'proposed', [])], []).saplingPresent).toBe(true);
  });
});

describe('WorldLegend (adaptive bar)', () => {
  it('offline world: no sessions entry; proof stays (the no-mark state IS the offline state)', () => {
    renderLegend(offlineWorld());
    for (const label of ['story trees', 'garden plants', 'proof marks', 'decoration']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'sessions' })).toBeNull();
    // roads and focus carry no legend entry — self-explanatory in place (ADR-0038)
    expect(screen.queryByRole('button', { name: 'roads' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'focus' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'proof marks' }));
    expect(screen.getByText(/also what offline looks like/)).toBeTruthy();
    // no signed verdicts anywhere — both badge tiles and the signpost are dimmed examples
    expect(screen.getByText('✓ proven').closest('.legend-tile')?.className).toContain('is-absent');
    expect(screen.getByText('signpost').closest('.legend-tile')?.className).toContain('is-absent');
    expect(screen.getByText('never built').closest('.legend-tile')?.className).not.toContain(
      'is-absent',
    );
  });

  it('verdicts and sessions light their states', () => {
    const stories = [
      story('s', 'mapped', [cap('c', 'mapped', { verdict: { outcome: 'pass', at: 'now' } })], {
        verdict: { outcome: 'pass', at: 'now' },
      }),
    ];
    renderLegend(stories, [session('s1', 'stale')]);
    fireEvent.click(screen.getByRole('button', { name: 'proof marks' }));
    expect(screen.getByText(/never a roll-up/)).toBeTruthy();
    expect(screen.getByText('✓ proven').closest('.legend-tile')?.className).not.toContain(
      'is-absent',
    );
    fireEvent.click(screen.getByRole('button', { name: 'sessions' }));
    expect(screen.getByText(/advisory only/)).toBeTruthy();
  });

  it('a story-only ✗ lights the signpost, not the capability badges', () => {
    renderLegend([
      story('s', 'mapped', [cap('c', 'mapped')], { verdict: { outcome: 'fail', at: 'now' } }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'proof marks' }));
    expect(
      screen.getByText('✗ last run failed').closest('.legend-tile')?.className,
    ).toContain('is-absent');
    expect(screen.getByText('signpost').closest('.legend-tile')?.className).not.toContain(
      'is-absent',
    );
  });

  it('Escape closes the drawer', () => {
    renderLegend(offlineWorld());
    fireEvent.click(screen.getByRole('button', { name: 'story trees' }));
    expect(screen.getByRole('region', { name: 'legend — story trees' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'legend — story trees' })).toBeNull();
  });

  it('the status fan dims absent states and filters present ones', () => {
    const onToggleStatus = vi.fn();
    renderLegend(offlineWorld(), [], { onToggleStatus });
    fireEvent.click(screen.getByRole('button', { name: 'story trees' }));
    // healthy / unhealthy don't occur in this world
    expect(screen.getAllByText('not in world yet')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /^proposed/ }));
    expect(onToggleStatus).toHaveBeenCalledWith('proposed');
    // building and retired are not legend states at all — the world folds
    // building into proposed and prunes retired (ADR-0038)
    expect(screen.queryByText('building')).toBeNull();
    expect(screen.queryByText('retired')).toBeNull();
  });

  it('hidden statuses surface the reset chip', () => {
    const onResetHidden = vi.fn();
    renderLegend(offlineWorld(), [], { hidden: new Set(['proposed']), onResetHidden });
    fireEvent.click(screen.getByRole('button', { name: /show all statuses \(1 hidden\)/ }));
    expect(onResetHidden).toHaveBeenCalled();
  });

  it('a second click on the open entry closes the drawer', () => {
    renderLegend(offlineWorld());
    const chip = screen.getByRole('button', { name: 'story trees' });
    fireEvent.click(chip);
    expect(screen.getByRole('region', { name: 'legend — story trees' })).toBeTruthy();
    fireEvent.click(chip);
    expect(screen.queryByRole('region', { name: 'legend — story trees' })).toBeNull();
  });
});
