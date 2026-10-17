import {LoadingBlock, LoadingStatus} from '@/components/ui/ContentLoading';
import styles from './WeeklyLoading.module.css';

export function WeeklyLatestSkeleton({label}: {label: string}) {
  return <div data-loading-layout="weekly-latest"><LoadingStatus label={label}/><div aria-busy="true" className={styles.latest}><div className={styles.copy}><LoadingBlock className={styles.issue}/><LoadingBlock className={styles.title}/><LoadingBlock className={styles.line}/></div><LoadingBlock className={styles.actions}/></div></div>;
}

export function WeeklyArchiveSkeleton({label}: {label: string}) {
  return <div data-loading-layout="weekly-archive"><LoadingStatus label={label}/><div aria-busy="true" className={styles.archive}>{Array.from({length:6},(_,index)=><div key={index} className={styles.row}><LoadingBlock className={styles.issue}/><div className={styles.copy}><LoadingBlock className={styles.title}/><LoadingBlock className={styles.line}/></div><LoadingBlock className={styles.actions}/></div>)}</div></div>;
}

export function WeeklyLandingSkeleton({label}: {label: string}) {
  return <section className={`shell ${styles.landing}`}><LoadingStatus label={label}/><div aria-busy="true" aria-hidden="true" className={styles.copy}><LoadingBlock className={styles.heading}/><LoadingBlock className={styles.line}/><LoadingBlock className={styles.tabs}/><WeeklyLatestSkeleton label={label}/><WeeklyArchiveSkeleton label={label}/></div></section>;
}

export function HomeWeeklySkeleton({label}: {label: string}) {
  return <div data-loading-layout="weekly-home"><LoadingStatus label={label}/><div aria-busy="true" className={styles.home}><LoadingBlock className={styles.mark}/><LoadingBlock className={styles.issue}/><LoadingBlock className={styles.title}/><LoadingBlock className={styles.actions}/></div></div>;
}
