import {relativeTime} from '@/lib/relative-time';
import type {InboxItem} from '@hallelujahhomechurch/account-client';
import type {NotificationAppHref, NotificationListItem} from '@hallelujahhomechurch/ui';
import type {Locale} from '@/i18n/locales';
import {validIssueNumber, targetQuery, weeklyEntryTarget} from '@/features/weekly/entry-target';
export function notificationItem(item: InboxItem, locale: Locale, copy: {generic: string; published: string; open: string}): NotificationListItem {
  const {projection} = item, action = projection.action;
  let href: NotificationAppHref | undefined;
  if (action?.type === 'recording') href = `/${locale}/member-videos/${action.resource.id}`;
  if (action?.type === 'join_request_review') href = `/${locale}/organizations/${action.resource.unitId}?joinRequest=${action.resource.id}#join-requests`;
  if (action?.type === 'join_request_result') href = `/${locale}/organizations/requests/${action.resource.id}`;
  const issue = projection.parameters?.issueNumber;
  if (action?.type === 'bulletin' && issue && validIssueNumber(issue)) {
    const query = new URLSearchParams({series: action.resource.series, issueNumber:issue, contentLocale:action.locale});
    const target = weeklyEntryTarget(query);
    if (target?.issueNumber) href = `/${locale}/literature-ministry?${targetQuery(target)}` as NotificationAppHref;
  }
  const content = ['notification.recording','notification.bulletin'].includes(projection.titleKey) && projection.messageKey === 'notification.published';
  return {id:item.id, title:content && projection.parameters?.title || copy.generic, message:content ? copy.published : '', timeLabel:relativeTime(item.occurredAt,locale),dateTime:item.occurredAt,isRead:Boolean(item.readAt),...(href ? {link:{href,label:copy.open}} : {})};
}
