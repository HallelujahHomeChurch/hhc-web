import {Skeleton} from '@hallelujahhomechurch/ui';
import styles from './ContentLoading.module.css';

export function LoadingBlock({className = ''}: {className?: string}) {
  return <div aria-hidden="true" className={className}><Skeleton label="" className={styles.block}/></div>;
}

export function LoadingStatus({label}: {label: string}) {
  return <span role="status" className="sr-only">{label}</span>;
}
