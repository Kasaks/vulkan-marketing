import type { APIRoute } from 'astro';
import { site as data } from '../data/site';
import { articles } from '../data/articles';

export const GET: APIRoute = ({ site }) => {
  const indexable = !data.demoMode && import.meta.env.SITE_INDEXABLE === 'true';
  const pages = [
    '/',
    '/blog/',
    ...articles.filter(article => article.status === 'published')
      .map(article => `/blog/${article.slug}/`),
  ];
  const urls = indexable
    ? pages.map(path => `<url><loc>${new URL(path, site).href}</loc></url>`).join('')
    : '';
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  return new Response(content, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
