import type {ComponentProps, RefObject} from 'react';
import {IconButton} from '@hallelujahhomechurch/ui';

/** Shared button primitive with a native hover label; no reader-specific button styling. */
export function ReaderIconButton({title, buttonRef, ...props}: ComponentProps<typeof IconButton> & {title?: string; buttonRef?: RefObject<HTMLButtonElement | null>}) {
  return <span className="reader-icon-control" title={title ?? props['aria-label']} ref={element => {if (buttonRef) buttonRef.current = element?.querySelector('button') ?? null;}}><IconButton {...props}/></span>;
}
