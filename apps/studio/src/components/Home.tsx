import { useAppData } from '../lib/appData';
import { docHref, libraryHref } from '../lib/route';

export function Home(): React.JSX.Element {
  const { docs, assets, comments } = useAppData();
  const open = comments.filter((c) => !c.resolved).length;
  const firstAdr = docs.find((d) => d.group === 'Decisions');

  return (
    <div className="home pad">
      <h1>storytree studio</h1>
      <p className="lede">
        The foundation surface — a <strong>forum</strong> over the project’s decision corpus.
        Documents and guidance assets are <em>topics</em>; comments are <em>posts</em>. (The
        PixiJS story-tree comes later; this is the static-content foundation.)
      </p>

      <div className="stat-row">
        <Stat n={docs.length} label="documents" href={firstAdr ? docHref(firstAdr.id) : undefined} />
        <Stat n={assets.length} label="guidance assets" href={libraryHref} />
        <Stat n={open} label="open comments" />
      </div>

      <div className="cap-grid">
        <CapCard title="Browse & read">
          Every ADR, the glossary, open-questions, and adjudication — rendered with stable
          section anchors and in-corpus cross-links. Start in the sidebar.
        </CapCard>
        <CapCard title="Comment & resolve">
          Attach feedback to a whole document or a specific section heading, see it inline in the
          right rail, and resolve it when addressed. Persisted to the repo.
        </CapCard>
        <CapCard title="Guidance library">
          Modular, injectable guidance <em>assets</em> — typed <code>principle</code> /{' '}
          <code>definition</code> / <code>guideline</code> units, tagged, browsable, and
          cross-referenced to the corpus. The seed of an injectable guidance library.
        </CapCard>
      </div>

      <p className="muted small">
        Note: “guidance asset” is deliberately qualified — the glossary reserves bare{' '}
        <code>asset</code> for tree/game art. See the studio README for the data model and design
        choices.
      </p>
    </div>
  );
}

function Stat({ n, label, href }: { n: number; label: string; href?: string | undefined }): React.JSX.Element {
  const inner = (
    <>
      <span className="stat-n">{n}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  return href ? (
    <a className="stat" href={href}>
      {inner}
    </a>
  ) : (
    <div className="stat">{inner}</div>
  );
}

function CapCard({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="cap-card">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
