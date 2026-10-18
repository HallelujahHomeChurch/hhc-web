import {LoadingBlock,LoadingStatus} from '@/components/ui/ContentLoading';
import styles from './OrganizationLoading.module.css';

function Rows({count=4}: {count?:number}) {
  return <div className={styles.rows}>{Array.from({length:count},(_,index)=><div key={index} className={styles.row}><LoadingBlock className={styles.name}/><LoadingBlock className={styles.detail}/></div>)}</div>;
}
export function OrganizationRootsSkeleton({label}: {label:string}) {
  return <section data-loading-layout="organization-roots"><LoadingStatus label={label}/><div aria-busy="true" className={styles.page}><LoadingBlock className={styles.heading}/><Rows/></div></section>;
}
export function OrganizationDirectorySkeleton({label}: {label:string}) {
  return <section data-loading-layout="organization-directory"><LoadingStatus label={label}/><div aria-busy="true" className={styles.page}><LoadingBlock className={styles.heading}/><Rows count={5}/></div></section>;
}
export function OrganizationMemberSkeleton({label}: {label:string}) {
  return <section data-loading-layout="organization-member"><LoadingStatus label={label}/><div aria-busy="true" className={styles.page}><LoadingBlock className={styles.heading}/><LoadingBlock className={styles.name}/><Rows count={3}/></div></section>;
}
export function OrganizationRowsSkeleton({columns}: {columns:number}) {
  return Array.from({length:5},(_,index)=><tr key={index} aria-hidden="true"><td colSpan={columns}><div className={styles.tableRow}><LoadingBlock className={styles.name}/><LoadingBlock className={styles.detail}/></div></td></tr>);
}
export function OrganizationHistorySkeleton({label}: {label:string}) {
  return <div data-loading-layout="organization-history"><LoadingStatus label={label}/><div aria-busy="true"><Rows count={3}/></div></div>;
}
