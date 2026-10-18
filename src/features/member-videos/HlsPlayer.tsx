'use client';

import {useRouter} from 'next/navigation';
import {HlsPlayer as SharedHlsPlayer, type HlsPlayerProps} from '@hallelujahhomechurch/ui/player';
import '@hallelujahhomechurch/ui/player.css';
export type {PlayerLabels} from '@hallelujahhomechurch/ui/player';

export function HlsPlayer(props:HlsPlayerProps) {
  const router=useRouter();
  return <SharedHlsPlayer {...props} onNavigate={href=>router.push(href)}/>;
}
