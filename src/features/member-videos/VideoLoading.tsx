import {LoadingBlock, LoadingStatus} from '@/components/ui/ContentLoading';
import styles from './MemberVideoZone.module.css';
import commentStyles from './VideoComments.module.css';

function VideoCards({count = 6}: {count?: number}) {
  return Array.from({length: count}, (_, index) => <div key={index} className={`${styles.card} ${styles.skeletonCard}`}>
    <LoadingBlock className={styles.thumbnail}/><div className={styles.info}><LoadingBlock className={styles.skeletonTitle}/><LoadingBlock className={styles.skeletonLine}/></div>
  </div>);
}

export function VideoListSkeleton({label, search = false}: {label: string; search?: boolean}) {
  return <div className={styles.skeletonRegion} data-loading-layout={search ? 'video-search' : 'video-library'}>
    <LoadingStatus label={label}/><div aria-busy="true" className={search ? styles.searchList : styles.grid}><VideoCards/></div>
  </div>;
}

export function VideoWatchSkeleton({label, recommendations = true}: {label: string; recommendations?: boolean}) {
  return <div className={styles.skeletonWatch} data-loading-layout="video-watch">
    <LoadingStatus label={label}/><div aria-busy="true" className={styles.video}><LoadingBlock className={styles.thumbnail}/><LoadingBlock className={styles.skeletonTitle}/><LoadingBlock className={styles.skeletonLine}/><LoadingBlock className={styles.skeletonInformation}/></div>
    {recommendations ? <VideoRecommendationsSkeleton/> : null}
  </div>;
}

export function VideoRecommendationsSkeleton() {
  return <div data-loading-recommendations aria-busy="true" className={styles.recommendations}><VideoCards count={3}/></div>;
}

export function VideoCommentsSkeleton({label, replies = false}: {label: string; replies?: boolean}) {
  return <div data-loading-layout={replies ? 'video-replies' : 'video-comments'}>
    <LoadingStatus label={label}/><div aria-busy="true" className={commentStyles.skeletonList}>
      {Array.from({length: replies ? 2 : 3}, (_, index) => <div key={index} className={`${commentStyles.skeletonComment} ${replies ? commentStyles.skeletonReply : ''}`}>
        <LoadingBlock className={commentStyles.skeletonAvatar}/><div><LoadingBlock className={commentStyles.skeletonName}/><LoadingBlock className={commentStyles.skeletonText}/></div>
      </div>)}
    </div>
  </div>;
}
