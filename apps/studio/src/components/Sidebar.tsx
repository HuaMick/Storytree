import { useAppData, openCount } from '../lib/appData';
import { docHref, libraryHref, type Route } from '../lib/route';
import { ASSET_CATEGORIES, type DocMeta } from '../types';

export function Sidebar({ route }: { route: Route }): React.JSX.Element {
  const { docs, assets, comments } = useAppData();
  const adrs = docs.filter((d) => d.group === 'Decisions');
  const reference = docs.filter((d) => d.group !== 'Decisions');
  const activeDocId = route.name === 'doc' ? route.id : null;
  const libCat = route.name === 'library' ? route.category : undefined;

  return (
    <aside className="sidebar">
      <div className="side-section">
        <div className="side-head">Library</div>
        <ul className="side-list">
          <li>
            <a
              className={route.name === 'library' && libCat === null ? 'side-item active' : 'side-item'}
              href={libraryHref()}
            >
              <span className="side-item-label">All artifacts</span>
              <span className="badge ghost">{assets.length}</span>
            </a>
          </li>
          {ASSET_CATEGORIES.map((cat) => {
            const n = assets.filter((a) => a.category === cat).length;
            if (n === 0) return null;
            return (
              <li key={cat}>
                <a
                  className={libCat === cat ? 'side-item sub active' : 'side-item sub'}
                  href={libraryHref(cat)}
                >
                  <span className={`cat-dot cat-${cat}`} />
                  <span className="side-item-label">{cat}</span>
                  <span className="badge ghost">{n}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      <DocSection title="ADRs (history)" docs={adrs} activeDocId={activeDocId} comments={comments} />
      <DocSection title="Reference" docs={reference} activeDocId={activeDocId} comments={comments} />
    </aside>
  );
}

function DocSection({
  title,
  docs,
  activeDocId,
  comments,
}: {
  title: string;
  docs: DocMeta[];
  activeDocId: string | null;
  comments: ReturnType<typeof useAppData>['comments'];
}): React.JSX.Element | null {
  if (docs.length === 0) return null;
  return (
    <div className="side-section">
      <div className="side-head">{title}</div>
      <ul className="side-list">
        {docs.map((doc) => {
          const open = openCount(comments, doc.id);
          return (
            <li key={doc.id}>
              <a
                className={doc.id === activeDocId ? 'side-item active' : 'side-item'}
                href={docHref(doc.id)}
                title={doc.title}
              >
                <span className="side-item-label">{doc.title}</span>
                {open > 0 && (
                  <span className="badge" title={`${open} open comment(s)`}>
                    {open}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
