import { AlertDialog, Button, Dialog, Pagination, Tabs } from '@hhc/ui'
import { Plus, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '../../auth/auth-context'
import { StatusBadge } from '../../components/StatusBadge'
import type { ContentItem, ContentModule, ContentRevision, ContentWriteInput } from '../../lib/cms-api'

const locales = [
  { id: 'zh-Hant', label: '繁體中文' },
  { id: 'zh-Hans', label: '简体中文' },
  { id: 'en', label: 'English' },
] as const

type Draft = Omit<ContentWriteInput, 'translations'> & { translations: Array<{ locale: 'zh-Hant' | 'zh-Hans' | 'en'; title: string; summary: string; body: string; dateLabel: string; imageAlt: string }> }

const moduleLabels: Record<ContentModule, string> = {
  news: 'Latest news',
  history: 'History',
  videos: 'Kingdom Joy',
}

export function ContentModulePage({ module }: { module: ContentModule }) {
  const { cmsApi } = useAuth()
  const [items, setItems] = useState<ContentItem[]>([])
  const [selectedID, setSelectedID] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(module))
  const [isCreating, setCreating] = useState(false)
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [revisions, setRevisions] = useState<ContentRevision[]>([])
  const requestSequence = useRef(0)
  const selected = useMemo(() => items.find((item) => item.id === selectedID) ?? null, [items, selectedID])

  useEffect(() => {
    const controller = new AbortController()
    const sequence = ++requestSequence.current
    setLoading(true)
    setError(null)
    void cmsApi.listContent(module, { page, pageSize: 20, signal: controller.signal }).then((response) => {
      if (sequence !== requestSequence.current) return
      setItems(response.data)
      setTotal(response.meta.total)
      setSelectedID((current) => response.data.some((item) => item.id === current) ? current : response.data[0]?.id ?? null)
    }).catch(() => {
      if (sequence === requestSequence.current && !controller.signal.aborted) setError(`Unable to load ${moduleLabels[module].toLowerCase()}.`)
    }).finally(() => {
      if (sequence === requestSequence.current && !controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [cmsApi, module, page, reloadKey])

  useEffect(() => {
    if (!selected || isCreating) return
    setDraft(draftFromItem(module, selected))
  }, [isCreating, module, selected])

  function beginCreate() {
    setCreating(true)
    setSelectedID(null)
    setDraft(emptyDraft(module))
    setMessage(null)
  }

  async function saveDraft(event: React.FormEvent) {
    event.preventDefault()
    const input = cleanInput(draft)
    setSaving(true)
    setError(null)
    try {
      const saved = isCreating
        ? await cmsApi.createContent(module, input, crypto.randomUUID())
        : selected
          ? await cmsApi.updateContent(module, selected.id, selected.version, input)
          : null
      if (!saved) return
      replaceItem(saved)
      setCreating(false)
      setMessage('Draft saved.')
    } catch {
      setError('Unable to save this draft. Reload if another editor changed it.')
    } finally {
      setSaving(false)
    }
  }

  async function changePublication(action: 'publish' | 'unpublish') {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const next = action === 'publish'
        ? await cmsApi.publishContent(module, selected.id, selected.version)
        : await cmsApi.unpublishContent(module, selected.id, selected.version)
      replaceItem(next)
      setMessage(action === 'publish' ? 'Published.' : 'Unpublished.')
    } catch {
      setError(action === 'publish' && module === 'news' ? 'Add a clean cover image and complete all required fields before publishing.' : `Unable to ${action} this content.`)
    } finally {
      setSaving(false)
    }
  }

  function replaceItem(next: ContentItem) {
    setItems((current) => [next, ...current.filter((item) => item.id !== next.id)])
    setSelectedID(next.id)
    setDraft(draftFromItem(module, next))
  }

  async function loadRevisions() {
    if (!selected) return
    setRevisions(await cmsApi.listContentRevisions(module, selected.id))
  }

  async function restoreRevision(revision: number) {
    if (!selected) return
    try {
      replaceItem(await cmsApi.restoreContentRevision(module, selected.id, revision, selected.version))
      setMessage(`Revision ${revision} restored as a new draft.`)
    } catch {
      setError('Unable to restore this revision. Reload and try again.')
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <h1>{moduleLabels[module]}</h1>
        <Button onPress={beginCreate}><Plus size={17} aria-hidden="true" />Create</Button>
      </header>
      {message ? <p className="notice">{message}</p> : null}
      {error ? <div className="error-notice" role="alert"><span>{error}</span><Button variant="secondary" onPress={() => setReloadKey((value) => value + 1)}>Retry</Button></div> : null}
      <div className="content-editor-layout">
        <section className="content-list" aria-label={`${moduleLabels[module]} list`}>
          <header><strong>{isLoading ? 'Loading' : `${total} items`}</strong></header>
          {items.map((item) => (
            <button key={item.id} className={item.id === selectedID ? 'content-list-item is-selected' : 'content-list-item'} type="button" onClick={() => { setCreating(false); setSelectedID(item.id) }}>
              <span><strong>{item.translations[0]?.title || 'Untitled'}</strong><small>{item.displayDate || item.translations[0]?.dateLabel || item.youtubeVideoId}</small></span>
              <StatusBadge tone={item.status === 'published' ? 'success' : 'neutral'}>{item.status}</StatusBadge>
            </button>
          ))}
          {!isLoading && items.length === 0 ? <p className="content-empty">No content yet.</p> : null}
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} labels={{ previous: 'Previous', next: 'Next' }} />
        </section>

        <form className="content-editor" onSubmit={(event) => void saveDraft(event)}>
          <header className="content-editor-header">
            <strong>{isCreating ? `New ${moduleLabels[module]}` : selected?.translations[0]?.title ?? 'Select an item'}</strong>
            {selected ? <StatusBadge tone={selected.status === 'published' ? 'success' : 'neutral'}>{selected.status}</StatusBadge> : null}
          </header>
          {isCreating || selected ? (
            <>
              <ModuleFields module={module} draft={draft} onChange={setDraft} />
              <Tabs
                label="Content locale"
                items={locales.map((locale) => ({ id: locale.id, label: locale.label, content: <TranslationFields key={locale.id} module={module} locale={locale.id} draft={draft} onChange={setDraft} /> }))}
              />
              {module === 'news' ? <div className="content-cover-placeholder"><strong>Cover image</strong><span>{selected?.coverAssetId ? 'Image attached' : 'Upload will be available after the draft is saved.'}</span></div> : null}
              <div className="content-editor-actions">
                {!isCreating && selected ? (
                  <Dialog trigger={<Button type="button" variant="ghost" onPress={() => void loadRevisions()}><RotateCcw size={16} />Revisions</Button>} title="Revision history">
                    {revisions.length ? revisions.map((revision) => <div className="revision-row" key={revision.version}><span>Version {revision.version}</span><Button variant="secondary" onPress={() => void restoreRevision(revision.version)}>Restore</Button></div>) : <p>No revisions available.</p>}
                  </Dialog>
                ) : null}
                <Button type="submit" isDisabled={isSaving}>{isSaving ? 'Saving' : 'Save draft'}</Button>
                {!isCreating && selected ? (
                  <AlertDialog
                    trigger={<Button type="button" variant={selected.status === 'published' ? 'danger' : 'secondary'}>{selected.status === 'published' ? 'Unpublish' : 'Publish'}</Button>}
                    title={selected.status === 'published' ? 'Unpublish this content?' : 'Publish this content?'}
                    description={selected.status === 'published' ? 'It will be removed from the public website.' : 'The current localized content will become public.'}
                    confirmLabel={selected.status === 'published' ? 'Unpublish' : 'Publish'}
                    cancelLabel="Cancel"
                    confirmVariant={selected.status === 'published' ? 'danger' : 'primary'}
                    onConfirm={() => void changePublication(selected.status === 'published' ? 'unpublish' : 'publish')}
                  />
                ) : null}
              </div>
            </>
          ) : <p className="content-empty">Select an item or create a new draft.</p>}
        </form>
      </div>
    </section>
  )
}

function ModuleFields({ module, draft, onChange }: { module: ContentModule; draft: Draft; onChange: (draft: Draft) => void }) {
  if (module === 'news') return <div className="content-fields"><LabeledInput label="Slug" value={draft.slug ?? ''} onChange={(slug) => onChange({ ...draft, slug })} /><LabeledInput label="Display date" type="date" value={draft.displayDate ?? ''} onChange={(displayDate) => onChange({ ...draft, displayDate })} /><LabeledCheckbox label="Feature on home" checked={draft.featured ?? false} onChange={(featured) => onChange({ ...draft, featured })} /></div>
  if (module === 'history') return <div className="content-fields"><LabeledInput label="Sort order" type="number" value={String(draft.sortOrder ?? '')} onChange={(value) => onChange({ ...draft, sortOrder: Number(value) })} /></div>
  return <div className="content-fields"><LabeledInput label="YouTube video ID" value={draft.youtubeVideoId ?? ''} onChange={(youtubeVideoId) => onChange({ ...draft, youtubeVideoId })} /><LabeledCheckbox label="Eligible for home" checked={draft.homeEligible ?? true} onChange={(homeEligible) => onChange({ ...draft, homeEligible })} /></div>
}

function TranslationFields({ module, locale, draft, onChange }: { module: ContentModule; locale: Draft['translations'][number]['locale']; draft: Draft; onChange: (draft: Draft) => void }) {
  const value = draft.translations.find((item) => item.locale === locale)!
  const update = (patch: Partial<typeof value>) => onChange({ ...draft, translations: draft.translations.map((item) => item.locale === locale ? { ...item, ...patch } : item) })
  return <div className="translation-fields"><LabeledInput label="Title" value={value.title} onChange={(title) => update({ title })} />{module === 'news' ? <><LabeledInput label="Summary" value={value.summary} onChange={(summary) => update({ summary })} /><LabeledTextArea label="Body" value={value.body} onChange={(body) => update({ body })} /><LabeledInput label="Image description" value={value.imageAlt} onChange={(imageAlt) => update({ imageAlt })} /></> : null}{module === 'history' ? <><LabeledInput label="Date label" value={value.dateLabel} onChange={(dateLabel) => update({ dateLabel })} /><LabeledTextArea label="Event" value={value.body} onChange={(body) => update({ body })} /></> : null}</div>
}

function LabeledInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="content-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function LabeledTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="content-field"><span>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function LabeledCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="content-checkbox"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label> }

function emptyDraft(module: ContentModule): Draft { return { slug: '', displayDate: '', sortOrder: module === 'history' ? 10 : undefined, youtubeVideoId: '', coverAssetId: '', featured: false, homeEligible: true, translations: locales.map((locale) => ({ locale: locale.id, title: '', summary: '', body: '', dateLabel: '', imageAlt: '' })) } }
function draftFromItem(module: ContentModule, item: ContentItem): Draft {
  const draft = emptyDraft(module)
  return {
    ...draft,
    ...item,
    translations: draft.translations.map((translation) => {
      const saved = item.translations.find((value) => value.locale === translation.locale)
      return saved ? {
        ...translation,
        ...saved,
        summary: saved.summary ?? '',
        body: saved.body ?? '',
        dateLabel: saved.dateLabel ?? '',
        imageAlt: saved.imageAlt ?? '',
      } : translation
    }),
  }
}
function cleanInput(draft: Draft): ContentWriteInput { return { slug: draft.slug || undefined, displayDate: draft.displayDate || undefined, sortOrder: draft.sortOrder || undefined, youtubeVideoId: draft.youtubeVideoId || undefined, coverAssetId: draft.coverAssetId || undefined, featured: draft.featured, homeEligible: draft.homeEligible, translations: draft.translations.filter((value) => value.title.trim()).map((value) => ({ ...value, title: value.title.trim() })) } }
