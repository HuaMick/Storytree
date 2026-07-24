import React from 'react';
import type { SceneNode, SceneStatus } from '@storytree/forest-world';
import { SceneView, type SceneCtx } from './SceneView.js';
import type { SpriteStyleSheet } from './sprite-sheet.js';
import type { TrailRevealPlan } from './trailReveal.js';

export interface WorldPresentationModel {
  readonly scene: SceneNode;
  readonly selectedStoryId: string | null;
  readonly emphasizedStoryIds: readonly string[];
  readonly hiddenStatuses: readonly SceneStatus[];
  readonly arrivalIds: readonly string[];
  readonly reveal: TrailRevealPlan | null;
  readonly spriteSheet: SpriteStyleSheet | null;
  readonly artScale: number;
}

export interface WorldPresentationModelInput {
  readonly scene: SceneNode;
  readonly selectedStoryId?: string | null;
  readonly emphasizedStoryIds?: readonly string[];
  readonly hiddenStatuses?: readonly SceneStatus[];
  readonly arrivalIds?: readonly string[];
  readonly reveal?: TrailRevealPlan | null;
  readonly spriteSheet?: SpriteStyleSheet | null;
  readonly artScale?: number;
}

export interface WorldPresentationEvents {
  readonly onSelectStory?: (storyId: string) => void;
  readonly onSelectCapability?: (storyId: string, capabilityId: string) => void;
}

function sortedUnique<T extends string>(values: readonly T[] | undefined): readonly T[] {
  return [...new Set(values ?? [])].sort();
}

/** Normalize a plain presentation input without consulting time, stores, or live authority. */
export function normalizeWorldPresentationModel(
  input: WorldPresentationModelInput,
): WorldPresentationModel {
  return {
    scene: input.scene,
    selectedStoryId: input.selectedStoryId ?? null,
    emphasizedStoryIds: sortedUnique(input.emphasizedStoryIds),
    hiddenStatuses: sortedUnique(input.hiddenStatuses),
    arrivalIds: sortedUnique(input.arrivalIds),
    reveal: input.reveal ?? null,
    spriteSheet: input.spriteSheet ?? null,
    artScale: input.artScale ?? 1,
  };
}

const NOOP_SELECT_STORY = (): void => {};
const NOOP_SELECT_CAPABILITY = (): void => {};

export function WorldSceneView({
  model,
  events,
}: {
  readonly model: WorldPresentationModel;
  readonly events?: WorldPresentationEvents;
}): React.JSX.Element {
  const ctx = React.useMemo<SceneCtx>(() => {
    const emphasized = new Set(model.emphasizedStoryIds);

    return {
      territoryClassById: (id, status) => {
        const classes = ['hex-territory', `st-${status}`];
        if (id === model.selectedStoryId) classes.push('is-selected');
        if (emphasized.has(id)) classes.push('is-emphasized');
        return classes.join(' ');
      },
      reveal: model.reveal,
      hidden: new Set(model.hiddenStatuses),
      arrivalIds: new Set(model.arrivalIds),
      onSelectStory: events?.onSelectStory ?? NOOP_SELECT_STORY,
      onSelectCap: events?.onSelectCapability ?? NOOP_SELECT_CAPABILITY,
      spriteSheet: model.spriteSheet,
      artScale: model.artScale,
    };
  }, [model, events]);

  return <SceneView scene={model.scene} ctx={ctx} />;
}
