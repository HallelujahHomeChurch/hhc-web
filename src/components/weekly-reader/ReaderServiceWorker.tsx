'use client';
import {useEffect} from 'react';
import {isWeeklyReaderEnabled} from '@/features/weekly-reader/enabled';

export function ReaderServiceWorker() {
  useEffect(() => {
    if (isWeeklyReaderEnabled() && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
