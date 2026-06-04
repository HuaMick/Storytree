import { useMemo, useState } from 'react';
import { api } from '../api';
import { useAppData } from '../lib/appData';
import { useOperator } from '../lib/operator';
import { formatDateTime } from '../lib/format';
import { parseHeadings } from '../lib/markdown';
import {
  assetEditHref,
  assetHref,
  docHref,
  libraryHref,
  navigate,
} from '../lib/route';
import { ASSET_CATEGORY_GLOSS, type CommentAnchor } from '../types';
import { Markdown } from './Markdown';
import { CommentPanel } from './CommentPanel';

const TOPIC_ANCHOR: CommentAnchor = { kind: 'topic', headingSlug: null, headingText: null };

export function AssetView({ id }: { id: string }): React.JSX.Element {
  const { assets, refreshAssets } = useAppData();
  const [operator] = useOperator();
  const [target, setTarget] = useState<CommentAnchor>(TOPIC_ANCHOR);
  const asset = assets.find((a) => a.id === id);
  const headings = useMemo(() => (asset ? parseHeadings(asset.body) : []), [asset]);

  if (!asset) {
    return (
      <div className="pad error-box">
        <h2>Asset not found</h2>
        <p className="muted">
          No guidance asset with id <code>{id}</code>.{' '}
          <a href={libraryHref}>Back to the library</a>.
        </p>
      </div>
    );
  }

  async function remove(): Promise<void> {
    if (!window.confirm(`Delete guidance asset “${asset!.title}”?`)) return;
    await api.deleteAsset(id);
    await refreshAssets();
    navigate(libraryHref);
  }

  return (
    <div className="doc-layout">
      <article className="doc asset-detail">
        <div className="doc-crumb muted small">
          <a href={libraryHref}>guidance library</a> / {asset.id}
        </div>
        <div className="asset-detail-head">
          <span className={`chip cat-${asset.category}`} title={ASSET_CATEGORY_GLOSS[asset.category]}>
            {asset.category}
          </span>
          <span className="muted small">{ASSET_CATEGORY_GLOSS[asset.category]}</span>
        </div>
        <h1>{asset.title}</h1>
        <p className="lede">{asset.description}</p>

        {asset.tags.length > 0 && (
          <div className="tag-row">
            {asset.tags.map((t) => (
              <span key={t} className="tag">
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="asset-body">
          <Markdown>{asset.body}</Markdown>
        </div>

        {asset.references.length > 0 && (
          <div className="asset-refs">
            <h4>References</h4>
            <ul>
              {asset.references.map((r) => (
                <li key={r}>
                  <RefLink refStr={r} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="asset-foot muted small">
          <span>id: <code>{asset.id}</code></span>
          <span>created {formatDateTime(asset.createdAt)}</span>
          <span>updated {formatDateTime(asset.updatedAt)}</span>
        </div>

        <div className="asset-actions">
          <a className="btn" href={assetEditHref(asset.id)}>
            Edit
          </a>
          <button type="button" className="btn ghost danger" onClick={() => void remove()}>
            Delete
          </button>
        </div>
      </article>

      <CommentPanel
        topicKind="asset"
        topicId={asset.id}
        headings={headings}
        operator={operator}
        target={target}
        setTarget={setTarget}
      />
    </div>
  );
}

function RefLink({ refStr }: { refStr: string }): React.JSX.Element {
  const { docIds, docTitles, assets } = useAppData();
  if (refStr.startsWith('doc:')) {
    const docId = refStr.slice('doc:'.length);
    return docIds.has(docId) ? (
      <a href={docHref(docId)}>{docTitles.get(docId) ?? docId}</a>
    ) : (
      <span className="muted">{refStr} (unknown doc)</span>
    );
  }
  if (refStr.startsWith('asset:')) {
    const assetId = refStr.slice('asset:'.length);
    const found = assets.find((a) => a.id === assetId);
    return found ? (
      <a href={assetHref(assetId)}>{found.title}</a>
    ) : (
      <span className="muted">{refStr} (unknown asset)</span>
    );
  }
  return <span>{refStr}</span>;
}
