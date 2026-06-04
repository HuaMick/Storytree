import { useAppData, openCount } from '../lib/appData';
import { docHref, libraryHref, type Route } from '../lib/route';
import type { DocMeta } from '../types';

export function Sidebar({ route }: { route: Route }): React.JSX.Element {
  const { docs, assets, comments } = useAppData();
  const groups = groupDocs(docs);
  const activeDocId = route.name === 'doc' ? route.id : null;
  const libraryActive = route.name === 'library' || route.name.startsWith('asset');

  return (
    <aside className="sidebar">
      <div className="side-section">
        <div className="side-head">Documents</div>
        {groups.map(([group, items]) => (
          <div key={group} className="side-group">
            <div className="side-group-label">{group}</div>
            <ul className="side-list">
              {items.map((doc) => {
                const open = openCount(comments, doc.id);
                return (
                  <li key={doc.id}>
                    <a
                      className={doc.id === activeDocId ? 'side-item active' : 'side-item'}
                      href={docHref(doc.id)}
                      title={doc.title}
                    >
                      <span className="side-item-label">{doc.title}</span>
                      {open > 0 && <span className="badge" title={`${open} open comment(s)`}>{open}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="side-section">
        <div className="side-head">Guidance library</div>
        <ul className="side-list">
          <li>
            <a className={libraryActive ? 'side-item active' : 'side-item'} href={libraryHref}>
              <span className="side-item-label">All guidance assets</span>
              <span className="badge ghost">{assets.length}</span>
            </a>
          </li>
        </ul>
      </div>
    </aside>
  );
}

function groupDocs(docs: DocMeta[]): Array<[string, DocMeta[]]> {
  const order = ['Decisions', 'Reference'];
  const byGroup = new Map<string, DocMeta[]>();
  for (const doc of docs) {
    const list = byGroup.get(doc.group) ?? [];
    list.push(doc);
    byGroup.set(doc.group, list);
  }
  const seen = new Set(order);
  const keys = [...order.filter((g) => byGroup.has(g)), ...[...byGroup.keys()].filter((g) => !seen.has(g))];
  return keys.map((g) => [g, byGroup.get(g) ?? []]);
}
