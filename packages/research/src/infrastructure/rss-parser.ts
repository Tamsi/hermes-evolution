export interface RssItem {
  title: string;
  link: string;
  description: string;
}

export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks.slice(0, 20)) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = stripHtml(extractTag(block, 'description'));
    if (title && link) {
      items.push({ title, link, description: description.slice(0, 800) });
    }
  }

  return items;
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match?.[1]) return '';
  return decodeEntities(match[1].trim());
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}
