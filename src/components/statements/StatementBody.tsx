import type {ReactNode} from 'react';
import type {StatementDocument, StatementInline} from '@/features/news/types';
import {StatementImage} from './StatementImage';

const align = {start: 'text-start', center: 'text-center', end: 'text-end'} as const;
const imageWidth = {small: 'max-w-sm', medium: 'max-w-xl', full: 'max-w-full'} as const;
const imageAlign = {start: 'mr-auto', center: 'mx-auto', end: 'ml-auto'} as const;

function inline(nodes?: StatementInline[]): ReactNode {
  return nodes?.map((node, index) => {
    if (node.type === 'lineBreak') return <br key={index} />;
    if (node.type === 'link') return <a key={index} href={node.href} title={node.title} className="text-primary underline underline-offset-2" rel="noopener noreferrer">{inline(node.content)}</a>;
    let value: ReactNode = node.text;
    if (node.marks?.includes('emphasis')) value = <em>{value}</em>;
    if (node.marks?.includes('strong')) value = <strong>{value}</strong>;
    return <span key={index}>{value}</span>;
  });
}

export function StatementBody({body, bodyJson, locale, imageLabels}: {body: string; bodyJson?: StatementDocument; locale: string; imageLabels: {open: string; close: string}}) {
  if (!bodyJson) return <div lang={locale} className="whitespace-pre-wrap break-words text-[17px] leading-[1.95] text-ink">{body}</div>;

  return <div lang={locale} className="break-words text-[17px] leading-[1.95] text-ink">
    {bodyJson.blocks.map((block) => {
      if (block.type === 'paragraph') return <p key={block.id} className={`mb-5 whitespace-pre-wrap ${align[block.alignment ?? 'start']}`}>{inline(block.content)}</p>;
      if (block.type === 'heading') {
        const className = `mb-4 mt-8 font-semibold leading-snug ${block.level === 2 ? 'text-2xl' : 'text-xl'} ${align[block.alignment ?? 'start']}`;
        return block.level === 2 ? <h2 key={block.id} className={className}>{inline(block.content)}</h2> : <h3 key={block.id} className={className}>{inline(block.content)}</h3>;
      }
      if (block.type === 'quote') return <blockquote key={block.id} className="my-6 border-s-4 border-primary/40 ps-5 italic"><p>{inline(block.content)}</p>{block.source?.length ? <cite className="mt-2 block text-sm not-italic text-muted">{inline(block.source)}</cite> : null}</blockquote>;
      if (block.type === 'list') {
        const List = block.ordered ? 'ol' : 'ul';
        return <List key={block.id} className={`mb-5 ms-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{block.items.map((item, index) => <li key={index}>{inline(item.content)}</li>)}</List>;
      }
      if (block.type === 'image') {
        const alt = block.alt.mode === 'text' ? block.alt.text : '';
        return <figure key={block.id} className={`my-7 ${imageWidth[block.size ?? 'full']} ${imageAlign[block.alignment ?? 'center']}`}>
          <StatementImage src={block.url} alt={alt} openLabel={imageLabels.open} closeLabel={imageLabels.close} />
          {block.caption?.length ? <figcaption className="mt-2 text-center text-sm leading-relaxed text-muted">{inline(block.caption)}</figcaption> : null}
        </figure>;
      }
      return null;
    })}
  </div>;
}
