'use client';
import {useLinkStatus} from 'next/link';
import styles from './NavigationPendingIndicator.module.css';

export function NavigationPendingIndicator() {
  const {pending}=useLinkStatus();
  return <span data-navigation-pending data-pending={pending||undefined} aria-hidden="true" className={styles.indicator}/>;
}
