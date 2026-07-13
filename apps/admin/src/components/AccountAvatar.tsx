import { Avatar, type AvatarProps } from '@hhc/ui'

import { displayAccountName } from '../lib/account-display'
import type { Profile } from '../lib/api'

export function AccountAvatar({
  className,
  profile,
  size = 'md',
}: {
  className?: string
  profile: Pick<Profile, 'avatar_url' | 'email' | 'first_name' | 'last_name'> | null | undefined
  size?: AvatarProps['size']
}) {
  return <Avatar className={['account-avatar', className].filter(Boolean).join(' ')} name={displayAccountName(profile)} src={profile?.avatar_url} size={size} />
}
