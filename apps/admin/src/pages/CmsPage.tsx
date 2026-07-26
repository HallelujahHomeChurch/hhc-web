import { Button, Card, Form, Input, Label, Modal, ProgressBar, TextField } from '@hhc/ui'
import { Pagination as SharedPagination, Select as SharedSelect } from '@hhc/ui'
import { FileText, Plus, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { StatusBadge } from '../components/StatusBadge'
import type { BulletinIssue, BulletinLocale, BulletinStatus } from '../lib/cms-api'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZES = [20, 50, 100]
const MAX_PDF_SIZE = 20 << 20
const locales: Array<{ id: BulletinLocale; label: string }> = [
  { id: 'zh-Hant', label: 'Traditional Chinese' },
  { id: 'zh-Hans', label: 'Simplified Chinese' },
  { id: 'en', label: 'English' },
]

type UploadDialog = { issue: BulletinIssue; locale: BulletinLocale } | null
type PublicationDialog = { issue: BulletinIssue; locale: BulletinLocale; action: 'publish' | 'unpublish' } | null

export function CmsPage() {
  const { cmsApi } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = positiveInteger(searchParams.get('page'), 1)
  const requestedPageSize = positiveInteger(searchParams.get('page_size'), DEFAULT_PAGE_SIZE)
  const pageSize = PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE
  const requestedStatus = searchParams.get('status')
  const status = isBulletinStatus(requestedStatus) ? requestedStatus : undefined
  const [issues, setIssues] = useState<BulletinIssue[]>([])
  const [selectedID, setSelectedID] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [issueDate, setIssueDate] = useState('')
  const [uploadDialog, setUploadDialog] = useState<UploadDialog>(null)
  const [publicationDialog, setPublicationDialog] = useState<PublicationDialog>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isSaving, setSaving] = useState(false)
  const requestSequence = useRef(0)

  const selected = useMemo(
    () => issues.find((issue) => issue.id === selectedID) ?? issues[0] ?? null,
    [issues, selectedID],
  )

  useEffect(() => {
    const controller = new AbortController()
    const sequence = ++requestSequence.current
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await cmsApi.listBulletins({ page, pageSize, status, signal: controller.signal })
        if (sequence !== requestSequence.current) return
        setIssues(response.data)
        setTotal(response.meta.total)
        setSelectedID((current) => response.data.some((issue) => issue.id === current) ? current : response.data[0]?.id ?? null)
      } catch (nextError) {
        if (sequence === requestSequence.current && !isAbortError(nextError)) setError('Unable to load weekly bulletins.')
      } finally {
        if (sequence === requestSequence.current && !controller.signal.aborted) setIsLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [cmsApi, page, pageSize, reloadKey, status])

  function updateSearchParams(updates: { page?: number; pageSize?: number; status?: string }) {
    const next = new URLSearchParams(searchParams)
    if (updates.page !== undefined) setOptionalParam(next, 'page', updates.page === 1 ? '' : String(updates.page))
    if (updates.pageSize !== undefined) setOptionalParam(next, 'page_size', updates.pageSize === DEFAULT_PAGE_SIZE ? '' : String(updates.pageSize))
    if (updates.status !== undefined) setOptionalParam(next, 'status', updates.status)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!selected || !isPublicationPending(selected.status)) return
    const timer = window.setInterval(() => {
      void cmsApi.getBulletin(selected.id).then(replaceIssue).catch(() => undefined)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [cmsApi, selected])

  function replaceIssue(next: BulletinIssue) {
    setIssues((current) => current.map((issue) => issue.id === next.id ? next : issue))
    setSelectedID(next.id)
  }

  async function createIssue(event: React.FormEvent) {
    event.preventDefault()
    if (!issueDate) return
    setSaving(true)
    setError(null)
    try {
      const created = await cmsApi.createBulletin(issueDate, uniqueKey())
      updateSearchParams({ page: 1 })
      setIssues((current) => [created, ...current.filter((issue) => issue.id !== created.id)])
      setSelectedID(created.id)
      setTotal((current) => current + (issues.some((issue) => issue.id === created.id) ? 0 : 1))
      setIssueDate('')
      setCreateOpen(false)
      setMessage('Issue created.')
    } catch {
      setError('Unable to create the bulletin issue.')
    } finally {
      setSaving(false)
    }
  }

  function openUpload(issue: BulletinIssue, locale: BulletinLocale) {
    const version = issue.versions.find((item) => item.locale === locale)
    setUploadDialog({ issue, locale })
    setUploadTitle(version?.title ?? '')
    setUploadFile(null)
    setMessage(null)
  }

  async function attachUpload(event: React.FormEvent) {
    event.preventDefault()
    if (!uploadDialog || !uploadFile || !uploadTitle.trim()) return
    if (uploadFile.type !== 'application/pdf' || uploadFile.size <= 0 || uploadFile.size > MAX_PDF_SIZE) {
      setError('Choose a PDF no larger than 20 MiB.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const checksum = await sha256(uploadFile)
      const created = await cmsApi.createBulletinUpload(uploadDialog.issue.id, {
        locale: uploadDialog.locale,
        fileName: uploadFile.name,
        mimeType: 'application/pdf',
        sizeBytes: uploadFile.size,
      }, uniqueKey())
      await cmsApi.uploadFile(created.uploadTarget, uploadFile)
      const updated = await cmsApi.completeBulletinUpload(uploadDialog.issue.id, created.asset.id, uploadDialog.issue.version, {
        locale: uploadDialog.locale,
        title: uploadTitle.trim(),
        fileName: uploadFile.name,
        mimeType: 'application/pdf',
        sizeBytes: uploadFile.size,
        checksumSha256: checksum,
      })
      replaceIssue(updated)
      setUploadDialog(null)
      setMessage('PDF attached.')
    } catch {
      setError('Unable to upload and attach the PDF.')
    } finally {
      setSaving(false)
    }
  }

  async function changePublication() {
    if (!publicationDialog) return
    const { issue, locale, action } = publicationDialog
    setSaving(true)
    setError(null)
    try {
      if (action === 'publish') {
        await cmsApi.publishBulletin(issue.id, issue.version, locale)
      } else {
        await cmsApi.unpublishBulletin(issue.id, issue.version, locale)
      }
      replaceIssue(await cmsApi.getBulletin(issue.id))
      setPublicationDialog(null)
      setMessage(action === 'publish' ? 'Publication started.' : 'Unpublishing started.')
    } catch {
      setError(`Unable to ${action} the bulletin.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <h1>Weekly bulletins</h1>
        <div className="page-actions">
          <Button onPress={() => setCreateOpen(true)}><Plus size={17} />Create issue</Button>
        </div>
      </header>

      <div className="toolbar">
        <SharedSelect
          label="Status"
          items={[
            { id: 'all', label: 'All statuses' },
            { id: 'draft', label: 'Draft' },
            { id: 'publishing', label: 'Publishing' },
            { id: 'published', label: 'Published' },
            { id: 'unpublishing', label: 'Unpublishing' },
            { id: 'unpublish_failed', label: 'Unpublish failed' },
            { id: 'unpublished', label: 'Unpublished' },
          ]}
          selectedKey={status ?? 'all'}
          onSelectionChange={(key) => updateSearchParams({ status: key === 'all' ? '' : key, page: 1 })}
        />
        <SharedSelect
          label="Rows per page"
          items={PAGE_SIZES.map((size) => ({ id: String(size), label: String(size) }))}
          selectedKey={String(pageSize)}
          onSelectionChange={(key) => updateSearchParams({ pageSize: Number(key), page: 1 })}
        />
      </div>

      {message ? <p className="notice">{message}</p> : null}
      {error ? <div className="error-notice" role="alert"><span>{error}</span><Button size="sm" variant="outline" onPress={() => setReloadKey((key) => key + 1)}>Retry</Button></div> : null}

      <div className="cms-split-view">
        <Card className="table-card cms-issue-list">
          <Card.Header>
            <Card.Title>Weekly bulletins</Card.Title>
            <Card.Description>{isLoading ? 'Loading issues' : `${total} issues`}</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="cms-table-scroll">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Languages</th><th>Status</th></tr></thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={issue.id} className={selected?.id === issue.id ? 'is-selected' : ''}>
                      <td><button className="table-row-action" type="button" onClick={() => setSelectedID(issue.id)} aria-label={`View bulletin ${issue.issueDate}`}><strong>{issue.issueDate}</strong></button></td>
                      <td>{issue.versions.length}/3</td>
                      <td><IssueStatus status={issue.status} /></td>
                    </tr>
                  ))}
                  {!isLoading && issues.length === 0 ? <tr><td className="empty-table-cell" colSpan={3}>Create the first weekly bulletin issue.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <SharedPagination
              page={page}
              totalPages={Math.ceil(total / pageSize)}
              onPageChange={(nextPage) => updateSearchParams({ page: nextPage })}
              labels={{ previous: 'Previous', next: 'Next' }}
            />
          </Card.Content>
        </Card>

        <Card className="inspector-card cms-inspector">
          <Card.Header>
            <Card.Title>{selected?.issueDate ?? 'No issue selected'}</Card.Title>
            {selected ? <IssueStatus status={selected.status} /> : null}
          </Card.Header>
          <Card.Content>
            {selected ? (
              <div className="cms-locale-list">
                {locales.map((locale) => {
                  const version = selected.versions.find((item) => item.locale === locale.id)
                  return (
                    <section className="cms-locale-row" key={locale.id}>
                      <div className="cms-locale-copy">
                        <div><strong>{locale.label}</strong>{version ? <IssueStatus status={version.status} /> : <StatusBadge>Not uploaded</StatusBadge>}</div>
                        <span>{version?.pdfFileName ?? 'No PDF attached'}</span>
                        {version?.workflowStatus === 'failed' ? <span className="form-error">{version.workflowError || 'Publication failed. Try again.'}</span> : null}
                      </div>
                      <div className="cms-locale-actions">
                        <Button size="sm" variant="outline" isDisabled={isPublicationPending(selected.status)} aria-label={`Upload PDF for ${locale.label}`} onPress={() => openUpload(selected, locale.id)}><Upload size={15} />{version ? 'Replace' : 'Upload'}</Button>
                        {version?.status === 'published' || version?.status === 'unpublish_failed' ? (
                          <Button size="sm" variant="danger" aria-label={`${version.status === 'unpublish_failed' ? 'Retry unpublish' : 'Unpublish'} ${locale.label}`} onPress={() => setPublicationDialog({ issue: selected, locale: locale.id, action: 'unpublish' })}>{version.status === 'unpublish_failed' ? 'Retry unpublish' : 'Unpublish'}</Button>
                        ) : version ? (
                          <Button size="sm" aria-label={`Publish ${locale.label}`} isDisabled={isPublicationPending(selected.status)} onPress={() => setPublicationDialog({ issue: selected, locale: locale.id, action: 'publish' })}>Publish</Button>
                        ) : null}
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : <p className="cms-empty-detail">Select an issue to manage its PDFs.</p>}
          </Card.Content>
        </Card>
      </div>

      <Modal isOpen={isCreateOpen} onOpenChange={setCreateOpen}>
        <Modal.Backdrop className="modal-backdrop"><Modal.Container className="modal-container" placement="center"><Modal.Dialog className="modal-dialog">
          <Modal.Header><Modal.Heading>Create weekly bulletin issue</Modal.Heading></Modal.Header>
          <Form onSubmit={(event) => void createIssue(event)}>
            <Modal.Body className="modal-form-grid"><TextField isRequired value={issueDate} onChange={setIssueDate}><Label>Issue date</Label><Input autoFocus type="date" /></TextField></Modal.Body>
            <Modal.Footer className="modal-actions"><Button slot="close" variant="tertiary">Cancel</Button><Button type="submit" isPending={isSaving}>Create</Button></Modal.Footer>
          </Form>
        </Modal.Dialog></Modal.Container></Modal.Backdrop>
      </Modal>

      <Modal isOpen={Boolean(uploadDialog)} onOpenChange={(open) => !open && setUploadDialog(null)}>
        <Modal.Backdrop className="modal-backdrop"><Modal.Container className="modal-container" placement="center"><Modal.Dialog className="modal-dialog">
          <Modal.Header><Modal.Heading>Upload weekly bulletin</Modal.Heading></Modal.Header>
          <Form onSubmit={(event) => void attachUpload(event)}>
            <Modal.Body className="modal-form-grid">
              <TextField isRequired value={uploadTitle} onChange={setUploadTitle}><Label>Title</Label><Input autoFocus /></TextField>
              <label className="cms-file-field"><span>PDF file</span><input aria-label="PDF file" accept="application/pdf,.pdf" type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} /><span className="cms-file-picker"><FileText size={17} />{uploadFile?.name ?? 'Choose PDF'}</span></label>
              {isSaving ? <ProgressBar isIndeterminate aria-label="Uploading PDF" size="sm"><ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track></ProgressBar> : null}
            </Modal.Body>
            <Modal.Footer className="modal-actions"><Button slot="close" variant="tertiary">Cancel</Button><Button type="submit" isPending={isSaving} isDisabled={!uploadFile || !uploadTitle.trim()}>Upload and attach</Button></Modal.Footer>
          </Form>
        </Modal.Dialog></Modal.Container></Modal.Backdrop>
      </Modal>

      <Modal isOpen={Boolean(publicationDialog)} onOpenChange={(open) => !open && setPublicationDialog(null)}>
        <Modal.Backdrop className="modal-backdrop"><Modal.Container className="modal-container" placement="center"><Modal.Dialog className="modal-dialog">
          <Modal.Header><Modal.Heading>{publicationDialog ? `${publicationDialog.action === 'publish' ? 'Publish' : 'Unpublish'} ${localeLabel(publicationDialog.locale)} bulletin?` : ''}</Modal.Heading></Modal.Header>
          <Modal.Body className="modal-form-grid"><p className="modal-copy">{publicationDialog?.action === 'publish' ? 'The clean PDF will become available on the public website.' : 'The PDF will stop being available from the public website.'}</p></Modal.Body>
          <Modal.Footer className="modal-actions"><Button slot="close" variant="tertiary">Cancel</Button><Button variant={publicationDialog?.action === 'unpublish' ? 'danger' : 'primary'} isPending={isSaving} onPress={() => void changePublication()}>{publicationDialog?.action === 'unpublish' ? 'Unpublish' : 'Publish'}</Button></Modal.Footer>
        </Modal.Dialog></Modal.Container></Modal.Backdrop>
      </Modal>
    </section>
  )
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function isBulletinStatus(value: string | null): value is BulletinStatus {
  return value === 'draft' || value === 'publishing' || value === 'published' || value === 'unpublishing' || value === 'unpublish_failed' || value === 'unpublished'
}

function setOptionalParam(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value)
  else params.delete(key)
}

function IssueStatus({ status }: { status: BulletinStatus }) {
  const tone = status === 'published' ? 'success' : isPublicationPending(status) ? 'warning' : status === 'unpublished' || status === 'unpublish_failed' ? 'danger' : 'neutral'
  return <StatusBadge tone={tone}>{status.replaceAll('_', ' ').replace(/^./, (value) => value.toUpperCase())}</StatusBadge>
}
function isPublicationPending(status: BulletinStatus) { return status === 'publishing' || status === 'unpublishing' }
function localeLabel(locale: BulletinLocale) { return locales.find((item) => item.id === locale)?.label ?? locale }
function uniqueKey() { return globalThis.crypto.randomUUID() }
function isAbortError(error: unknown) { return error instanceof DOMException && error.name === 'AbortError' }
async function sha256(file: File) {
  const bytes = await new Response(file).arrayBuffer()
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}
