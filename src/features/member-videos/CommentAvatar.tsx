'use client';

import {useState} from 'react';
import {Avatar} from '@hallelujahhomechurch/ui';
import type {RecordingComment} from '@hallelujahhomechurch/hhc-web-client';
import {commentAvatarURL} from './comment-avatar-cache';
import styles from './VideoComments.module.css';

export function CommentAvatar({comment}: {comment: RecordingComment}) {
  const url = commentAvatarURL(comment);
  const [failedComment, setFailedComment] = useState<RecordingComment>();
  // Retry only when a newly prepared payload arrives, never on an error loop.
  return <span aria-hidden="true" onErrorCapture={() => setFailedComment(comment)}>
    {comment.deleted || comment.hidden ? <span className={styles.avatar}/> :
      <Avatar name={comment.displayName} src={comment === failedComment ? undefined : url} className={styles.avatar}/>}
  </span>;
}
