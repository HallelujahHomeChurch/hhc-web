export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  children: React.ReactNode
}) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>
}
