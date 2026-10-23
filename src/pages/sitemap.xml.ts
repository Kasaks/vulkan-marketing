import type { APIRoute } from 'astro';
import { site as data } from '../data/site';
export const GET: APIRoute = ({ site }) => {
  const indexable = !data.demoMode && import.meta.env.SITE_INDEXABLE === 'true';
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${indexable ? `<url><loc>${new URL('/', site).href}</loc></url>` : ''}</urlset>`;
  return new Response(content, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
