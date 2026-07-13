import type { Profile } from './api'

export function displayAccountName(
  profile: Pick<Profile, 'email' | 'first_name' | 'last_name'> | null | undefined,
  fallback = 'Account',
) {
  if (!profile) return fallback
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || emailLocalPart(profile.email) || fallback
}

export function accountInitials(profile: Pick<Profile, 'email' | 'first_name' | 'last_name'> | null | undefined) {
  if (!profile) return 'HH'

  const nameInitials = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .map((part) => part?.trim().charAt(0))
    .join('')

  return (nameInitials || emailLocalPart(profile.email).slice(0, 2) || 'HH').toUpperCase()
}

function emailLocalPart(email: string) {
  return email.split('@')[0] ?? ''
}
