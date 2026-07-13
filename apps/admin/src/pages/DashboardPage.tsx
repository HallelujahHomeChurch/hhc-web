import { Card } from '@hhc/ui'
import { FileText, KeyRound, ShieldCheck } from 'lucide-react'

const cards = [
  {
    label: 'Website content',
    value: '4 modules',
    icon: FileText,
  },
  {
    label: 'Account access',
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
          <h1>Overview</h1>
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
    </section>
  )
}
