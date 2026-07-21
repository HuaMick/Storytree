// score.mjs — read the blind verdicts + the judge key, compute agreement rates.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const DIR = process.argv[2];
const key = JSON.parse(readFileSync(join(DIR, 'judge-key.json'), 'utf8'));
const keyById = Object.fromEntries(key.map((k) => [k.id, k]));

// which pairs are "aperture-fix" (the seam class we flagged as possibly sub-threshold)
const APERTURE = new Set(['seams-vs-compound-mushroom', 'seams-vs-compound-pagoda']);

const vdir = join(DIR, 'verdicts');
const files = readdirSync(vdir).filter((f) => f.endsWith('.txt'));
const votes = {}; // id -> [{v, why}]
for (const f of files) {
  const id = f.replace(/__v\d+\.txt$/, '');
  const txt = readFileSync(join(vdir, f), 'utf8');
  const m = txt.match(/VERDICT:\s*(A|B|SAME)/i);
  const w = txt.match(/WHY:\s*(.*)/i);
  if (!m) { console.error('unparsed', f); continue; }
  (votes[id] ??= []).push({ v: m[1].toUpperCase(), why: (w?.[1] ?? '').trim() });
}

const buckets = {
  'objective — depth order (station 3)': [],
  'taste — palette / shading (strong)': [],
  'taste — reveal depth (subtle)': [],
  'aperture fix — seams (near map-scale threshold)': [],
};
const bucketOf = (id) => {
  if (id.startsWith('centroid-vs-bsp')) return 'objective — depth order (station 3)';
  if (APERTURE.has(id)) return 'aperture fix — seams (near map-scale threshold)';
  if (id.startsWith('flush-vs-reveal') || id.startsWith('deep-vs-reveal')) return 'taste — reveal depth (subtle)';
  return 'taste — palette / shading (strong)';
};

let totJ = 0, totHit = 0;
const perPair = [];
for (const [id, vs] of Object.entries(votes)) {
  const k = keyById[id];
  const worse = k.worseSide; // 'A' | 'B'
  const better = worse === 'A' ? 'B' : 'A';
  const hits = vs.filter((x) => x.v === worse).length;      // agreed with ground truth
  const same = vs.filter((x) => x.v === 'SAME').length;      // abstained
  const falseRevert = vs.filter((x) => x.v === better).length; // picked the FIXED one as worse (dangerous)
  totJ += vs.length; totHit += hits;
  buckets[bucketOf(id)].push({ id, n: vs.length, hits, same, falseRevert });
  perPair.push({ id, bucket: bucketOf(id), worse, votes: vs.map((x) => x.v).join(','), hits, same, falseRevert, whys: vs.map((x) => x.why) });
}

const pct = (a, b) => (b === 0 ? 'n/a' : `${Math.round((100 * a) / b)}%`);

console.log('=== PER PAIR ===');
for (const p of perPair.sort((a, b) => a.bucket.localeCompare(b.bucket) || a.id.localeCompare(b.id))) {
  console.log(`\n[${p.bucket}]\n  ${p.id}  worse=${p.worse}  votes=[${p.votes}]  agreed=${p.hits}/${p.hits + p.same + p.falseRevert}  same=${p.same}  false-revert=${p.falseRevert}`);
  p.whys.forEach((w, i) => console.log(`     · ${w}`));
}

console.log('\n\n=== BY BUCKET ===');
for (const [name, arr] of Object.entries(buckets)) {
  const n = arr.reduce((s, x) => s + x.n, 0);
  const hits = arr.reduce((s, x) => s + x.hits, 0);
  const same = arr.reduce((s, x) => s + x.same, 0);
  const fr = arr.reduce((s, x) => s + x.falseRevert, 0);
  console.log(`  ${name}\n     pairs=${arr.length} judgments=${n}  agreement=${pct(hits, n)} (${hits}/${n})  same=${same}  false-revert=${fr}`);
}

// suprathreshold = everything except the aperture-seam bucket (verify empirically below)
const supra = perPair.filter((p) => p.bucket !== 'aperture fix — seams (near map-scale threshold)');
const supraN = supra.reduce((s, p) => s + p.hits + p.same + p.falseRevert, 0);
const supraHit = supra.reduce((s, p) => s + p.hits, 0);
const supraFR = supra.reduce((s, p) => s + p.falseRevert, 0);

const obj = perPair.filter((p) => p.bucket.startsWith('objective'));
const objN = obj.reduce((s, p) => s + p.hits + p.same + p.falseRevert, 0);
const objHit = obj.reduce((s, p) => s + p.hits, 0);

console.log('\n=== HEADLINE ===');
console.log(`  overall agreement:                 ${pct(totHit, totJ)} (${totHit}/${totJ})`);
console.log(`  objective depth-order agreement:   ${pct(objHit, objN)} (${objHit}/${objN})`);
console.log(`  suprathreshold (visible) agreement:${pct(supraHit, supraN)} (${supraHit}/${supraN})   false-reverts=${supraFR}`);
console.log(`  baseline (chance, A/B):            ~50%`);
