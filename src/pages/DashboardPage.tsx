import { Card } from '@heroui/react'
import { KeyRound, ShieldCheck, Users } from 'lucide-react'

const cards = [
  {
    label: 'Account operations',
    value: 'Users and roles',
    icon: Users,
  },
  {
    label: 'Permission model',
    value: 'RBAC backed',
    icon: ShieldCheck,
  },
  {
    label: 'OAuth clients',
    value: 'First-party apps',
    icon: KeyRound,
  },
]

export function DashboardPage() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Hallelujah Home Church</p>
          <h1>Admin Console</h1>
        </div>
      </header>

      <div className="metric-grid">
        {cards.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label} className="metric-card">
              <Card.Content>
                <Icon size={22} aria-hidden="true" />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </Card.Content>
            </Card>
          )
        })}
      </div>

      <section className="work-panel">
        <h2>Ready for CMS rollout</h2>
        <p>
          Account login, admin RBAC surfaces, and OAuth client management are prepared as the control layer for
          future CMS and service consoles.
        </p>
      </section>
    </section>
  )
}
