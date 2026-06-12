// The scripted shadow of the studio-foundation Story UAT
// (stories/studio-foundation/story.md § "Story UAT") — minimal-first: it executes the
// read-corpus + browse-library slice of the 13-step prose walkthrough (steps 1-2 and 7-9),
// one coherent operator journey against the REAL running studio (real dev server, real
// browser, real /api/* middleware, real seeded corpus). The only stub is the cross-story
// live-store seam: the server is pinned to the offline json backend (playwright.config.ts,
// STORYTREE_STUDIO_STORE=json) — ADR-0010 §5's mock-UAT allowance; in-story collaborators
// stay real. No Cloud SQL, no network, no API keys.
//
// Where the prose describes the pre-fold UI (a sidebar doc index, an 'all' chip), this
// script shadows the SAME journey through the current surfaces: the corpus index now lives
// in the Library (ADRs fold in under the `adr` category; the landing is one type-card per
// category). The mutating steps (4-6, 10-13: annotate/resolve/author) are later work.

import { test, expect } from '@playwright/test';

const ADR_0002 = 'decisions/0002-work-hierarchy-story-capability-contract.md';

test('story UAT (steps 1-2, 7-9): backbone up → read an ADR → browse the Library → follow a citation back to the corpus', async ({ page }) => {
  // —— Step 1: the persistence backbone is live. The app boots, the /api/* middleware
  // answers (the corpus loads), and the store badge confirms the offline json backend.
  await page.goto('/');
  await expect(page.locator('.brand-name')).toHaveText('storytree');
  await expect(page.locator('.store-badge')).toHaveText('offline store (json)');
  await expect(page.locator('.sidebar .side-head-link')).toHaveText('Library');

  // —— Step 2: read-corpus end-to-end. Open ADR-0002 (a doc-backed card in the Library's
  // adr category) and see it rendered as markdown from the real docs/ tree.
  await page.goto('/#/library/adr');
  await page.locator(`a.asset-card[href="#/doc/${encodeURIComponent(ADR_0002)}"]`).click();
  await expect(page.locator('article.doc h1').first()).toBeVisible();
  expect(page.url()).toContain('#/doc/decisions%2F0002');

  // —— Step 7: the Library landing renders the seeded corpus — one live-count type card
  // per non-empty category, served from the seeder's assets.json.
  await page.goto('/#/library');
  const principleCard = page.locator('a.asset-card.type-card', { hasText: 'Principles' });
  await expect(principleCard).toBeVisible();
  const principleCount = Number(await principleCard.locator('.badge').textContent());
  expect(principleCount).toBeGreaterThan(0);

  // —— Step 8: narrow by category, then by search — browse-library's filter end-to-end.
  await principleCard.click();
  await expect(page).toHaveURL(/#\/library\/principle$/);
  await expect(page.locator('.cat-gloss')).toContainText('principle');
  await expect(page.locator('ul.asset-grid a.asset-card')).toHaveCount(principleCount);
  await page.locator('input.search').fill('deep');
  const deepCard = page.locator('a.asset-card', { hasText: 'Deep modules' });
  await expect(deepCard).toBeVisible();
  expect(await page.locator('ul.asset-grid a.asset-card').count()).toBeLessThan(principleCount);

  // —— Step 9: open the artifact and follow its doc: citation back into the corpus —
  // the Library → corpus seam (browse-library riding read-corpus).
  await deepCard.click();
  await expect(page).toHaveURL(/#\/asset\/deep-modules$/);
  await expect(page.locator('article.asset-detail h1')).toHaveText('Deep modules');
  await expect(page.locator('.asset-refs h4')).toHaveText('Sources');
  await page.locator(`.asset-refs a[href="#/doc/${encodeURIComponent(ADR_0002)}"]`).click();
  await expect(page.locator('article.doc h1').first()).toBeVisible();
  expect(page.url()).toContain('#/doc/decisions');
});
