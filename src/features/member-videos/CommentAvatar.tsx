'use client';

import {useState} from 'react';
import {Avatar} from '@hallelujahhomechurch/ui';
import type {RecordingComment} from '@hallelujahhomechurch/hhc-web-client';
import {commentAvatarURL} from './comment-avatar-cache';
import styles from './VideoComments.module.css';

export type CommentProfile = Pick<RecordingComment, 'displayName' | 'avatarUrl'> & {deleted?: boolean; hidden?: boolean};

export function CommentAvatar({comment, size = 'root'}: {comment: CommentProfile; size?: 'root' | 'reply' | 'preview' | 'composer'}) {
  const url = commentAvatarURL(comment);
  const [failedComment, setFailedComment] = useState<CommentProfile>();
  const className = `${styles.avatar} ${size === 'reply' ? styles.replyAvatar : size === 'preview' ? styles.previewAvatar : size === 'composer' ? styles.composerAvatarImage : ''}`;
  // Retry only when a newly prepared payload arrives, never on an error loop.
  return <span aria-hidden="true" onErrorCapture={() => setFailedComment(comment)}>
    {comment.deleted || comment.hidden ? <span className={className}/> :
      <Avatar name={comment.displayName} src={comment === failedComment ? undefined : url} className={className}/>}
  </span>;
}
