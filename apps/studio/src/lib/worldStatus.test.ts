// ADR-0038 presentation rules: retired never renders, building wears proposed.
// Display-level — the payload/schema keep the full vocabulary, so these tests
// pin the prune/fold seam every world surface sits behind.

import { describe, it, expect } from 'vitest';
import { presentStories, worldStatus } from './worldStatus';
import type { TreeCapability, TreeStory, WorkStatus } from '../types';

const cap = (id: string, status: WorkStatus | null): TreeCapability => ({
  id,
  title: id,
  outcome: '',
  status,
  proofMode: 'red-green',
  dependsOn: [],
});

const story = (
  id: string,
  status: WorkStatus | null,
  capabilities: TreeCapability[] = [],
): TreeStory => ({
  id,
  title: id,
  outcome: '',
  status,
  proofMode: 'UAT',
  dependsOn: [],
  capabilities,
});

describe('worldStatus', () => {
  it('folds building into proposed and passes everything else through', () => {
    expect(worldStatus('building')).toBe('proposed');
    for (const st of ['proposed', 'mapped', 'healthy', 'unhealthy', 'retired', null] as const) {
      expect(worldStatus(st)).toBe(st);
    }
  });
});

describe('presentStories', () => {
  it('prunes retired stories entirely', () => {
    const out = presentStories([story('alive', 'mapped'), story('gone', 'retired')]);
    expect(out.map((s) => s.id)).toEqual(['alive']);
  });

  it('prunes retired capabilities from surviving stories', () => {
    const out = presentStories([
      story('s', 'mapped', [cap('keep', 'mapped'), cap('drop', 'retired')]),
    ]);
    expect(out[0]?.capabilities.map((c) => c.id)).toEqual(['keep']);
  });

  it('folds building into proposed on both tiers', () => {
    const out = presentStories([story('s', 'building', [cap('c', 'building')])]);
    expect(out[0]?.status).toBe('proposed');
    expect(out[0]?.capabilities[0]?.status).toBe('proposed');
  });

  it('leaves null status (spec error) and the rest of the shape untouched', () => {
    const input = [story('s', null, [cap('c', 'healthy')])];
    const out = presentStories(input);
    expect(out[0]?.status).toBeNull();
    expect(out[0]?.capabilities[0]?.status).toBe('healthy');
    // and never mutates its input
    expect(input[0]?.capabilities).toHaveLength(1);
  });
});
