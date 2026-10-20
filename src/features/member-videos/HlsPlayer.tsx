'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {HlsPlayer as SharedHlsPlayer, type HlsPlayerProps} from '@hallelujahhomechurch/ui/player';
import '@hallelujahhomechurch/ui/player.css';
import {createPlayerDiagnosticReporter} from '@/lib/player-observability';
export type {PlayerLabels} from '@hallelujahhomechurch/ui/player';

export function HlsPlayer(props:HlsPlayerProps) {
  const router=useRouter();
  const [onDiagnostic]=useState(createPlayerDiagnosticReporter);
  return <SharedHlsPlayer {...props} onDiagnostic={onDiagnostic} onNavigate={href=>router.push(href)}/>;
}
