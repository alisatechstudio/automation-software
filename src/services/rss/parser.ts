import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { isEnglishText } from '../../config/constants.js';

export interface ParsedArticle {
  guid: string;
  link: string;
  title: string;
  description: string;
  category: string;
  pubDate: Date;
  imageUrl?: string;
}

interface CustomItem {
  [key: string]: any;
  'media:content'?: { $: { url: string } } | Array<{ $: { url: string } }>;
  'media:thumbnail'?: { $: { url: string } } | Array<{ $: { url: string } }>;
  enclosure?: { url?: string; type?: string };
  category?: string | string[] | { _: string };
  'content:encoded'?: string;
  description?: string;
  title?: string;
  link?: string;
  guid?: string;
  id?: string;
  pubDate?: string;
  isoDate?: string;
  categories?: string[];
  content?: string;
  summary?: string;
}

export class RssParserService {
  private parser: Parser<Record<string, any>, CustomItem>;

  constructor() {
    this.parser = new Parser<Record<string, any>, CustomItem>({
      customFields: {
        item: [
          ['media:content', 'media:content'],
          ['media:thumbnail', 'media:thumbnail'],
          ['content:encoded', 'content:encoded'],
          ['enclosure', 'enclosure'],
        ],
      },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FBAutomationBot/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 15000,
    });
  }

  public async fetchAndParse(feedUrl: string, limit?: number): Promise<ParsedArticle[]> {
    try {
      const feed = await this.parser.parseURL(feedUrl);
      const items: ParsedArticle[] = [];
      const feedItems = typeof limit === 'number' && limit > 0
        ? (feed.items || []).slice(0, limit)
        : (feed.items || []);

      for (const item of feedItems) {
        const link = (item.link || '').trim();
        const guid = (item.guid || item.id || link).trim();
        if (!link && !guid) continue;

        const title = this.cleanText(item.title || '');
        const description = this.cleanHtmlSnippet(
          item['content:encoded'] || item.content || item.summary || item.description || ''
        );

        const isEnglishArticle = isEnglishText(title) || link.includes('trendingnews') || (feed.title && isEnglishText(feed.title));
        let category = isEnglishArticle ? 'Breaking News' : 'সাধারণ'; // Smart default: English or Bengali
        if (Array.isArray(item.categories) && item.categories.length > 0) {
          category = this.cleanText(item.categories[0]);
        } else if (typeof item.category === 'string') {
          category = this.cleanText(item.category);
        } else if (item.category && typeof item.category === 'object' && '_' in item.category) {
          category = this.cleanText(item.category._);
        }

        const pubDate = item.pubDate || item.isoDate ? new Date(item.pubDate || item.isoDate!) : new Date();

        // 1. Extract image from RSS feed fields instantly (zero latency)
        // Note: Do NOT scrape article pages in this loop over all 50 feed items, which causes 30s+ timeouts.
        // Images are lazy-loaded on-demand only for the specific single article that is chosen for rendering.
        const imageUrl = this.extractImageFromFeedItem(item);

        items.push({
          guid,
          link,
          title,
          description,
          category,
          pubDate,
          imageUrl,
        });
      }

      return items;
    } catch (error) {
      console.error(`[RssParser] Failed to parse feed: ${feedUrl}`, error);
      throw error;
    }
  }

  private extractImageFromFeedItem(item: CustomItem): string | undefined {
    // 1. Check enclosure
    if (item.enclosure?.url) {
      return item.enclosure.url;
    }

    // 2. Check media:content
    if (item['media:content']) {
      const media = item['media:content'];
      if (Array.isArray(media) && media.length > 0 && media[0].$?.url) {
        return media[0].$.url;
      } else if (!Array.isArray(media) && media.$?.url) {
        return media.$.url;
      }
    }

    // 3. Check media:thumbnail
    if (item['media:thumbnail']) {
      const thumb = item['media:thumbnail'];
      if (Array.isArray(thumb) && thumb.length > 0 && thumb[0].$?.url) {
        return thumb[0].$.url;
      } else if (!Array.isArray(thumb) && thumb.$?.url) {
        return thumb.$.url;
      }
    }

    // 4. Check HTML inside description or content:encoded for <img> tag
    const htmlToSearch = `${item['content:encoded'] || ''} ${item.content || ''} ${item.description || ''}`;
    if (htmlToSearch.includes('<img')) {
      const $ = cheerio.load(htmlToSearch);
      const src = $('img').first().attr('src');
      if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
        return src;
      }
    }

    return undefined;
  }

  public async scrapeOgImage(articleUrl: string): Promise<string | undefined> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(articleUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) return undefined;

      const html = await response.text();
      const $ = cheerio.load(html);

      const ogImage =
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        $('meta[itemprop="image"]').attr('content') ||
        $('article img').first().attr('src') ||
        $('main img').first().attr('src');

      if (ogImage && (ogImage.startsWith('http://') || ogImage.startsWith('https://'))) {
        return ogImage;
      }
    } catch {
      // Non-critical fallback failure
    }
    return undefined;
  }

  private cleanText(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanHtmlSnippet(html: string): string {
    const $ = cheerio.load(html);
    return this.cleanText($.text() || '');
  }
}
