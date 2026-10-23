'use client';

import {useState} from 'react';
import {Avatar} from '@hallelujahhomechurch/ui';
import type {RecordingComment} from '@hallelujahhomechurch/hhc-web-client';
import {preparedCommentAvatar} from './comment-avatar-cache';
import styles from './VideoComments.module.css';

export function CommentAvatar({comment}: {comment: RecordingComment}) {
  const url = preparedCommentAvatar(comment);
  const [failedURL, setFailedURL] = useState<string>();
  return <span aria-hidden="true" onErrorCapture={() => setFailedURL(url)}>
    {comment.deleted || comment.hidden ? <span className={styles.avatar}/> :
      <Avatar name={comment.displayName} src={url === failedURL ? undefined : url} className={styles.avatar}/>}
  </span>;
}
