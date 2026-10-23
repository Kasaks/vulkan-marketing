import { defineConfig } from 'astro/config';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// Astro evaluates its config before Vite loads .env. Node reads it here too.
if (existsSync('.env')) loadEnvFile('.env');
const site = process.env.SITE_URL || 'https://vulkan-marketing-demo.alive-kiwi-5120.chatgpt.site';
if (process.env.SITE_INDEXABLE === 'true' && (!process.env.SITE_URL || new URL(site).hostname === 'example.com')) {
  throw new Error('Set SITE_URL to the real website origin before enabling indexing.');
}
export default defineConfig({ site, output: 'static', trailingSlash: 'always' });
