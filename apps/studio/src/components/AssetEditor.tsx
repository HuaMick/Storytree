import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAppData } from '../lib/appData';
import { slugify } from '../lib/markdown';
import { missingSections, requiredSections, templateIdFor } from '../lib/templates';
import { assetHref, libraryHref, navigate } from '../lib/route';
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_GLOSS,
  type AssetCategory,
  type AssetInput,
} from '../types';
import { Markdown } from './Markdown';

interface AssetEditorProps {
  mode: 'new' | 'edit';
  id?: string;
}

interface FormState {
  id: string;
  category: AssetCategory;
  title: string;
  description: string;
  body: string;
  references: string;
}

const EMPTY: FormState = {
  id: '',
  category: 'pattern',
  title: '',
  description: '',
  body: '',
  references: '',
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function AssetEditor({ mode, id }: AssetEditorProps): React.JSX.Element {
  const { assets, refreshAssets } = useAppData();
  const existing = mode === 'edit' ? assets.find((a) => a.id === id) : undefined;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [idTouched, setIdTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && existing) {
      setForm({
        id: existing.id,
        category: existing.category,
        title: existing.title,
        description: existing.description,
        body: existing.body,
        references: existing.references.join(', '),
      });
      setIdTouched(true);
    } else if (mode === 'new') {
      setForm(EMPTY);
      setIdTouched(false);
    }
  }, [mode, existing]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // For new assets, derive the slug from the title until the user edits it.
  function onTitle(value: string): void {
    setForm((f) => ({
      ...f,
      title: value,
      id: mode === 'new' && !idTouched ? slugify(value) : f.id,
    }));
  }

  // Pre-fill the body from the seeded `template-<category>` scaffold. Offered only
  // when authoring a new non-template artifact (see `templateAsset` below).
  const templateAsset =
    mode === 'new' && form.category !== 'template'
      ? assets.find((a) => a.id === templateIdFor(form.category))
      : undefined;

  function startFromTemplate(): void {
    if (!templateAsset) return;
    if (form.body.trim() && !window.confirm(`Replace the current body with the ${form.category} template?`)) {
      return;
    }
    set('body', templateAsset.body);
    setError('');
  }

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    const input: AssetInput = {
      id: form.id.trim(),
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim(),
      body: form.body,
      references: splitList(form.references),
    };
    // Enforce the per-category template: block save when a required section is
    // missing (a guardrail must name how it is deterministically enforced).
    const missing = missingSections(input.body, requiredSections(input.category));
    if (missing.length > 0) {
      const sections = missing.map((s) => `“${s}”`).join(', ');
      setError(
        `A ${input.category} must include the ${sections} section${missing.length > 1 ? 's' : ''} before it can be saved` +
          (input.category === 'guardrail'
            ? ' — name the gate / schema / DB constraint / code path that makes it non-bypassable, or it is a pattern, not a guardrail.'
            : '.'),
      );
      return;
    }
    setBusy(true);
    try {
      const saved =
        mode === 'edit' && id
          ? await api.updateAsset(id, input)
          : await api.createAsset(input);
      await refreshAssets();
      navigate(assetHref(saved.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'edit' && !existing) {
    return (
      <div className="pad error-box">
        <h2>Artifact not found</h2>
        <p className="muted">
          Can’t edit <code>{id}</code>. <a href={libraryHref()}>Back to the Library</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="editor pad">
      <div className="doc-crumb muted small">
        <a href={libraryHref()}>library</a> / {mode === 'new' ? 'new artifact' : `edit ${id}`}
      </div>
      <h1>{mode === 'new' ? 'New artifact' : `Edit “${existing?.title}”`}</h1>

      <form className="editor-grid" onSubmit={save}>
        <div className="editor-fields">
          <label className="field">
            <span>Title</span>
            <input value={form.title} onChange={(e) => onTitle(e.target.value)} required />
          </label>

          <label className="field">
            <span>
              Id <small className="muted">(kebab-case slug — the filename-style key)</small>
            </span>
            <input
              value={form.id}
              onChange={(e) => {
                setIdTouched(true);
                set('id', e.target.value);
              }}
              disabled={mode === 'edit'}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </label>

          <label className="field">
            <span>Category</span>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value as AssetCategory)}
            >
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c} — {ASSET_CATEGORY_GLOSS[c]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>
              Description <small className="muted">(one line: what it is / when to inject it)</small>
            </span>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              required
            />
          </label>

          <div className="field">
            <div className="field-label-row">
              <span>Body (markdown)</span>
              {templateAsset && (
                <button type="button" className="btn small" onClick={startFromTemplate}>
                  Start from the {form.category} template
                </button>
              )}
            </div>
            <textarea
              className="mono"
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              rows={16}
              required
            />
            {requiredSections(form.category).length > 0 && (
              <p className="field-hint muted small">
                Required section{requiredSections(form.category).length > 1 ? 's' : ''}:{' '}
                {requiredSections(form.category)
                  .map((s) => `“${s}”`)
                  .join(', ')}{' '}
                — enforced on save.
              </p>
            )}
          </div>

          <label className="field">
            <span>
              References{' '}
              <small className="muted">
                (comma-separated; <code>doc:&lt;relpath&gt;</code> or <code>asset:&lt;id&gt;</code>)
              </small>
            </span>
            <input value={form.references} onChange={(e) => set('references', e.target.value)} />
          </label>

          {error && <p className="error-text">{error}</p>}

          <div className="editor-actions">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : mode === 'new' ? 'Create artifact' : 'Save changes'}
            </button>
            <a className="btn ghost" href={mode === 'edit' && id ? assetHref(id) : libraryHref()}>
              Cancel
            </a>
          </div>
        </div>

        <div className="editor-preview">
          <div className="preview-label muted small">Preview</div>
          <div className="asset-body">
            {form.body.trim() ? <Markdown>{form.body}</Markdown> : <p className="muted">Nothing yet.</p>}
          </div>
        </div>
      </form>
    </div>
  );
}
