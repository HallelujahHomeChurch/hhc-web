import {ListChevronsDownUp, ListChevronsUpDown, ALargeSmall, AArrowDown, AArrowUp} from 'lucide-react';
import {ReaderIconButton as IconButton} from './ReaderIconButton';
import type {ReaderMessages} from './ReaderToolbar';

export type Typography = {size: number; line: number};
export function readTypography(): Typography {
  try {
    const value = JSON.parse(localStorage.getItem('hhc-reader-typography') ?? 'null');
    if (value && Number.isFinite(value.size) && value.size >= 16 && value.size <= 28 && Number.isFinite(value.line) && value.line >= 1.4 && value.line <= 2.4) return {size: value.size, line: value.line};
  } catch { /* Local preferences are optional. */ }
  return {size: 18, line: 1.8};
}
export function ReaderTypography({value, onChange, messages: m}: {value: Typography; onChange: (value: Typography) => void; messages: ReaderMessages}) {
  return <div className="reader-type-grid" role="group" aria-label={m.typography}>
    <IconButton aria-label={m.fontDecrease} isDisabled={value.size <= 16} onPress={() => onChange({...value, size: Math.max(16, value.size - 2)})} icon={<AArrowDown aria-hidden="true"/>}/>
    <IconButton aria-label={m.fontIncrease} isDisabled={value.size >= 28} onPress={() => onChange({...value, size: Math.min(28, value.size + 2)})} icon={<AArrowUp aria-hidden="true"/>}/>
    <IconButton aria-label={m.lineDecrease} isDisabled={value.line <= 1.4} onPress={() => onChange({...value, line: Math.max(1.4, +(value.line - .2).toFixed(1))})} icon={<ListChevronsDownUp aria-hidden="true"/>}/>
    <IconButton aria-label={m.lineIncrease} isDisabled={value.line >= 2.4} onPress={() => onChange({...value, line: Math.min(2.4, +(value.line + .2).toFixed(1))})} icon={<ListChevronsUpDown aria-hidden="true"/>}/>
    <output aria-live="polite"><ALargeSmall size={16} aria-hidden="true"/> {value.size} / {value.line.toFixed(1)}</output>
  </div>;
}
