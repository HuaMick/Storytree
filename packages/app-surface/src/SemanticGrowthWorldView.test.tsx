// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildScene,
  type SceneInput,
  type SceneTrailsInput,
} from '@storytree/forest-world';
import { normalizeWorldPresentationModel } from './WorldSceneView.js';
import { SemanticGrowthWorldView } from './SemanticGrowthWorldView.js';
import * as AppSurfacePackageRoot from './index.js';

afterEach(cleanup);

const ORDERED_KEYS = [
  'empty',
  'land',
  'proposed',
  'claimed',
  'signed-proof',
  'healthy',
] as const;

const NO_TRAILS: SceneTrailsInput = {
  segments: [],
  edges: [],
  caves: [],
  dropped: [],
};

function frameModel(key: (typeof ORDERED_KEYS)[number]) {
  const input: SceneInput = {
    offset: { x: 0, y: 0 },
    width: 100,
    height: 100,
    empties: [],
    relaxedCells: [],
    drawTiles: [],
    wheatSets: [new Set()],
    trails: NO_TRAILS,
    territories: [
      {
        id: 'semantic-growth',
        status: 'proposed',
        caps: 1,
        centroid: { x: 50, y: 50 },
        radius: 24,
        treeSpot: { x: 50, y: 45 },
        labelY: 76,
        coastPaths: ['M 20 20 L 80 20 L 50 80 Z'],
        decor: [],
        plants: [],
        treeTitle: `Growth frame: ${key}`,
        wisps:
          key === 'claimed'
            ? [{ runId: 'semantic-growth', title: 'A real work wisp', phase: 'IMPLEMENT' }]
            : [],
        plate: {
          w: 60,
          h: 30,
          rx: 7,
          idY: 13,
          subY: 25,
          idText: 'semantic-growth',
          subText: key,
          title: `Growth frame: ${key}`,
        },
      },
    ],
  };

  return normalizeWorldPresentationModel({ scene: buildScene(input) });
}

describe('SemanticGrowthWorldView', () => {
  it('plays the supplied semantic sequence deterministically, clamps navigation, and renders its real scene immediately without motion when reduced', () => {
    const frames = ORDERED_KEYS.map((key) => ({ key, model: frameModel(key) }));
    const view = render(
      <SemanticGrowthWorldView frames={frames} />,
    );

    const currentKey = (): string | null =>
      view.container.querySelector('[data-semantic-growth-frame]')?.getAttribute('data-semantic-growth-frame') ?? null;

    expect(currentKey()).toBe('empty');
    fireEvent.click(view.getByRole('button', { name: 'Back' }));
    expect(currentKey()).toBe('empty');

    for (const key of ORDERED_KEYS.slice(1)) {
      fireEvent.click(view.getByRole('button', { name: 'Next' }));
      expect(currentKey()).toBe(key);
    }
    fireEvent.click(view.getByRole('button', { name: 'Next' }));
    expect(currentKey()).toBe('healthy');

    fireEvent.click(view.getByRole('button', { name: 'Back' }));
    expect(currentKey()).toBe('signed-proof');
    fireEvent.click(view.getByRole('button', { name: 'Replay' }));
    expect(currentKey()).toBe('empty');
    fireEvent.click(view.getByRole('button', { name: 'Next' }));
    expect(currentKey()).toBe('land');

    for (const key of ['proposed', 'claimed'] as const) {
      fireEvent.click(view.getByRole('button', { name: 'Next' }));
      expect(currentKey()).toBe(key);
    }
    expect(view.container.querySelector('.world-wisp')).toBeTruthy();

    view.rerender(
      <SemanticGrowthWorldView
        frames={frames}
        reducedMotion
      />,
    );
    expect(currentKey()).toBe('claimed');
    expect(
      view.container
        .querySelector('[data-semantic-growth-frame]')
        ?.getAttribute('data-motion'),
    ).toBe('reduced');
    expect(view.container.querySelector('.world-wisp')).toBeTruthy();
    expect(view.container.querySelector('animateTransform')).toBeNull();

    expect(() =>
      render(
        <SemanticGrowthWorldView
          frames={[...frames.slice(0, 5), frames[4]! ]}
        />,
      ),
    ).toThrow(/six|duplicate|ordered/i);
  });

  it('exports the semantic growth player from the package root as the same public seam', () => {
    // Guidance: "Export the public seam from the package root." A consumer must be able to
    // reach this view via `@storytree/app-surface`'s root barrel (this file's `index.ts`),
    // not only via the internal `./SemanticGrowthWorldView.js` module path used above.
    const rootExport = (
      AppSurfacePackageRoot as { SemanticGrowthWorldView?: typeof SemanticGrowthWorldView }
    ).SemanticGrowthWorldView;
    expect(rootExport).toBe(SemanticGrowthWorldView);
  });
});
