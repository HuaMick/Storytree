import { useMemo, useState } from 'react';
import { useAppData, openCount } from '../lib/appData';
import { assetHref, assetNewHref } from '../lib/route';
import { ASSET_CATEGORIES, ASSET_CATEGORY_GLOSS, type AssetCategory } from '../types';

export function GuidanceLibrary(): React.JSX.Element {
  const { assets, comments } = useAppData();
  const [category, setCategory] = useState<AssetCategory | 'all'>('all');
  const [tag, setTag] = useState<string>('');
  const [query, setQuery] = useState('');

  const allTags = useMemo(
    () => [...new Set(assets.flatMap((a) => a.tags))].sort(),
    [assets],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (category !== 'all' && a.category !== category) return false;
      if (tag && !a.tags.includes(tag)) return false;
      if (q) {
        const hay = `${a.id} ${a.title} ${a.description} ${a.body}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [assets, category, tag, query]);

  return (
    <div className="library pad">
      <div className="library-head">
        <div>
          <h1>Guidance library</h1>
          <p className="muted">
            Modular, injectable units of agent guidance — the seed of an injectable guidance
            library (open-questions §9). Imported from v1 and authored fresh.
          </p>
        </div>
        <a className="btn primary" href={assetNewHref}>
          + New asset
        </a>
      </div>

      <div className="filters">
        <div className="filter-cats">
          <button
            type="button"
            className={category === 'all' ? 'chip-btn active' : 'chip-btn'}
            onClick={() => setCategory('all')}
          >
            all ({assets.length})
          </button>
          {ASSET_CATEGORIES.map((cat) => {
            const n = assets.filter((a) => a.category === cat).length;
            if (n === 0 && category !== cat) return null;
            return (
              <button
                key={cat}
                type="button"
                className={category === cat ? `chip-btn cat-${cat} active` : `chip-btn cat-${cat}`}
                onClick={() => setCategory(cat)}
                title={ASSET_CATEGORY_GLOSS[cat]}
              >
                {cat} ({n})
              </button>
            );
          })}
        </div>
        <div className="filter-row">
          <input
            className="search"
            placeholder="Search guidance…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {allTags.length > 0 && (
            <select value={tag} onChange={(e) => setTag(e.target.value)} className="tag-select">
              <option value="">all tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="muted pad-sm">No assets match.</p>
      ) : (
        <ul className="asset-grid">
          {filtered.map((a) => {
            const open = openCount(comments, a.id);
            return (
              <li key={a.id}>
                <a className="asset-card" href={assetHref(a.id)}>
                  <div className="asset-card-top">
                    <span className={`chip cat-${a.category}`}>{a.category}</span>
                    {open > 0 && <span className="badge" title={`${open} open comment(s)`}>{open}</span>}
                  </div>
                  <h3>{a.title}</h3>
                  <p className="asset-desc">{a.description}</p>
                  {a.tags.length > 0 && (
                    <div className="tag-row">
                      {a.tags.map((t) => (
                        <span key={t} className="tag">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
