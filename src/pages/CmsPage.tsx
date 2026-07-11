import { Card } from '@heroui/react'

export function CmsPage() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <h1>CMS</h1>
        </div>
      </header>

      <Card className="empty-card">
        <Card.Header>
          <Card.Title>CMS service is next</Card.Title>
          <Card.Description>
            This console has the navigation and auth boundary ready. The CMS editor should connect after `cms-api`
            exposes draft, revision, preview, and publish APIs.
          </Card.Description>
        </Card.Header>
      </Card>
    </section>
  )
}
