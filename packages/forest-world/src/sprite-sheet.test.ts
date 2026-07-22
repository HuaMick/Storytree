// Stage-1 red-green of the sprite art-sheet manifest contract (sprite-art-sheets spike): key
// precedence + null fallback (`resolveSprite`), throw-on-malformed validation (`parseStyleSheet`), and
// the ground-pivot offset math (`spritePlacement`). Pure data-in/data-out — no DOM, no React; the
// studio mapper's INTEGRATION (does a covered node actually render an `<image>` with no child
// recursion?) is pinned in `apps/studio/src/components/SceneView.test.tsx`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSprite, parseStyleSheet, spritePlacement, type SpriteStyleSheet } from './sprite-sheet.js';

function mkSheet(): SpriteStyleSheet {
  return {
    name: 'stub-a',
    label: 'Stub A',
    sprites: {
      tree: { href: '/art-sheets/stub-a/tree.svg', w: 40, h: 70, anchorX: 0.5, anchorY: 1 },
      'tree:unhealthy': { href: '/art-sheets/stub-a/tree-unhealthy.svg', w: 40, h: 70, anchorX: 0.5, anchorY: 1 },
      conifer: { href: '/art-sheets/stub-a/conifer.svg', w: 24, h: 34, anchorX: 0.5, anchorY: 1, scale: 2 },
    },
  };
}

test('resolveSprite — exact `${kind}:${status}` wins over the kind-only fallback', () => {
  const sheet = mkSheet();
  const hit = resolveSprite(sheet, 'tree', 'unhealthy');
  assert.equal(hit?.href, '/art-sheets/stub-a/tree-unhealthy.svg');
});

test('resolveSprite — falls back to the kind-only entry when no exact status match exists', () => {
  const sheet = mkSheet();
  const hit = resolveSprite(sheet, 'tree', 'healthy');
  assert.equal(hit?.href, '/art-sheets/stub-a/tree.svg');
});

test('resolveSprite — a kind with no status arg still resolves the kind-only entry', () => {
  const sheet = mkSheet();
  const hit = resolveSprite(sheet, 'conifer');
  assert.equal(hit?.href, '/art-sheets/stub-a/conifer.svg');
});

test('resolveSprite — returns null when neither the exact nor the kind-only key is covered', () => {
  const sheet = mkSheet();
  assert.equal(resolveSprite(sheet, 'flora', 'healthy'), null);
  assert.equal(resolveSprite(sheet, 'totally-unknown-kind'), null);
});

test('resolveSprite — an uncovered STATUS on a covered kind still falls back to the kind-only entry', () => {
  const sheet = mkSheet();
  // `tree:proposed` is not authored; must fall back to the bare `tree` entry, not null.
  const hit = resolveSprite(sheet, 'tree', 'proposed');
  assert.equal(hit?.href, '/art-sheets/stub-a/tree.svg');
});

test('spritePlacement — anchor (0.5, 1) (bottom-centre) seats the ground pivot at local (0,0)', () => {
  const place = spritePlacement({ href: 'x', w: 40, h: 70, anchorX: 0.5, anchorY: 1 });
  assert.deepEqual(place, { x: -20, y: -70, width: 40, height: 70 });
});

test('spritePlacement — anchor (0, 0) (top-left) needs no offset', () => {
  const place = spritePlacement({ href: 'x', w: 40, h: 70, anchorX: 0, anchorY: 0 });
  assert.deepEqual(place, { x: 0, y: 0, width: 40, height: 70 });
});

test('spritePlacement — anchor (1, 1) (bottom-right) offsets by the full box', () => {
  const place = spritePlacement({ href: 'x', w: 40, h: 70, anchorX: 1, anchorY: 1 });
  assert.deepEqual(place, { x: -40, y: -70, width: 40, height: 70 });
});

test('spritePlacement — `scale` scales the box BEFORE the pivot offset is computed', () => {
  const place = spritePlacement({ href: 'x', w: 24, h: 34, anchorX: 0.5, anchorY: 1, scale: 2 });
  assert.deepEqual(place, { x: -24, y: -68, width: 48, height: 68 });
});

test('parseStyleSheet — accepts a valid manifest and preserves every sprite', () => {
  const parsed = parseStyleSheet({
    name: 'stub-a',
    label: 'Stub A',
    sprites: {
      tree: { href: '/x/tree.svg', w: 10, h: 20, anchorX: 0.5, anchorY: 1 },
    },
  });
  assert.equal(parsed.name, 'stub-a');
  assert.equal(parsed.label, 'Stub A');
  assert.deepEqual(parsed.sprites.tree, { href: '/x/tree.svg', w: 10, h: 20, anchorX: 0.5, anchorY: 1 });
});

test('parseStyleSheet — round-trips a sprite carrying an optional `scale`', () => {
  const parsed = parseStyleSheet({
    name: 'stub-a',
    label: 'Stub A',
    sprites: { conifer: { href: '/x/conifer.svg', w: 10, h: 20, anchorX: 0.5, anchorY: 1, scale: 1.5 } },
  });
  assert.equal(parsed.sprites.conifer?.scale, 1.5);
});

test('parseStyleSheet — throws on a non-object manifest', () => {
  assert.throws(() => parseStyleSheet(null));
  assert.throws(() => parseStyleSheet('nope'));
  assert.throws(() => parseStyleSheet(42));
  assert.throws(() => parseStyleSheet(['not', 'an', 'object']));
});

test('parseStyleSheet — throws when "name" / "label" / "sprites" are missing or the wrong shape', () => {
  assert.throws(() => parseStyleSheet({ label: 'Stub A', sprites: {} }), /"name"/);
  assert.throws(() => parseStyleSheet({ name: 'stub-a', sprites: {} }), /"label"/);
  assert.throws(() => parseStyleSheet({ name: 'stub-a', label: 'Stub A' }), /"sprites"/);
  assert.throws(() => parseStyleSheet({ name: '', label: 'Stub A', sprites: {} }));
  assert.throws(() => parseStyleSheet({ name: 'stub-a', label: 'Stub A', sprites: 'nope' }));
});

test('parseStyleSheet — throws on a malformed sprite def (missing/invalid fields)', () => {
  const bad = (sprite: unknown): unknown => ({ name: 'stub-a', label: 'Stub A', sprites: { tree: sprite } });
  assert.throws(() => parseStyleSheet(bad({})), /"href"/); // missing href
  assert.throws(() => parseStyleSheet(bad({ href: '' })), /"href"/); // empty href
  assert.throws(() => parseStyleSheet(bad({ href: '/x.svg', w: 0, h: 10, anchorX: 0, anchorY: 0 })), /"w"/); // w<=0
  assert.throws(() => parseStyleSheet(bad({ href: '/x.svg', w: 10, h: -1, anchorX: 0, anchorY: 0 })), /"h"/); // h<=0
  assert.throws(
    () => parseStyleSheet(bad({ href: '/x.svg', w: 10, h: 10, anchorX: 'mid', anchorY: 0 })),
    /"anchorX"/,
  ); // non-numeric anchor
  assert.throws(
    () => parseStyleSheet(bad({ href: '/x.svg', w: 10, h: 10, anchorX: 0, anchorY: 0, scale: 0 })),
    /"scale"/,
  ); // scale<=0
  assert.throws(() => parseStyleSheet(bad('not-an-object')));
});
