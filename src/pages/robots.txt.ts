import type { APIRoute } from 'astro';
import { site as data } from '../data/site';
export const GET: APIRoute = ({ site }) => {
  const indexable = !data.demoMode && import.meta.env.SITE_INDEXABLE === 'true';
  // Allow crawling so robots can see the noindex meta tag on this demo.
  const content = `User-agent: *\nAllow: /\n${indexable ? `Sitemap: ${new URL('/sitemap.xml', site).href}\n` : '# Demo pages use the noindex meta tag.\n'}`;
  return new Response(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
