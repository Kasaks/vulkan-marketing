import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('dist');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const errorPage = await readFile(resolve(root, '404.html'), 'utf8');
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
assert.match(html, /<html[^>]*lang="ru"/);
assert.equal((html.match(/<h1\b/g) || []).length, 1, 'One main heading');
assert.match(html, /<title>Вулкан Маркетинг/);
assert.match(html, /name="description"/);
assert.match(html, /name="robots" content="noindex, follow"/, 'Demo must not be indexable');
assert.match(errorPage, /name="robots" content="noindex, follow"/);
assert.match(html, /rel="canonical" href="https:\/\//);

const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'No duplicate IDs');
for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target), `Missing link target: ${target}`);
for (const [, target] of html.matchAll(/data-dialog-open="([^"]+)"/g)) assert.ok(ids.includes(target), `Missing dialog: ${target}`);

const schemaText = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
assert.ok(schemaText, 'Structured data exists');
const schema = JSON.parse(schemaText);
assert.equal(schema['@context'], 'https://schema.org');
assert.deepEqual(schema['@graph'].map(item => item['@type']), ['Organization', 'WebSite', 'WebPage']);
assert.ok(!schemaText.includes('Review') && !schemaText.includes('AggregateRating'), 'No fake review markup');
for (const entity of schema['@graph']) assert.equal(new URL(entity.url).protocol, 'https:');

for (const text of ['Маркетинг', 'Стратегия', 'Реклама', 'Аналитика', 'Почему', 'Как строится работа', 'Отзывы', 'Обсудим вашу задачу?', 'сервисного бизнеса', 'онлайн-покупке', 'сложного продукта', 'Учебные примеры', 'данные никуда не отправляются']) assert.ok(html.includes(text), `Missing static content: ${text}`);
assert.equal((markup.match(/data-slide\b/g) || []).length, 6, 'All cases and reviews are in HTML');
assert.equal((markup.match(/data-active="true"/g) || []).length, 2, 'One initial slide per carousel');

const localAssets = Array.from(html.matchAll(/(?:src|href)="(\/(?:_astro|images)\/[^"?#]+)"/g), match => match[1]);
for (const asset of localAssets) assert.ok((await stat(resolve(root, '.' + asset))).isFile(), `Missing asset: ${asset}`);
const inlineScripts = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g));
let scriptsChecked = 0;
for (const [, attrs, text] of inlineScripts) {
  if (/application\/ld\+json/.test(attrs)) continue;
  if (text.trim()) {
    const check = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: text, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr); scriptsChecked++;
  }
}
assert.ok(scriptsChecked >= 2, 'Theme boot and interaction scripts are compiled');
const robots = await readFile(resolve(root, 'robots.txt'), 'utf8');
assert.match(robots, /Allow: \//);
assert.ok(!robots.includes('Sitemap:'), 'Demo sitemap is not advertised');
const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
assert.ok(!sitemap.includes('<loc>'), 'Demo URLs are not submitted for indexing');
console.log(`Verified: static content, anchors, 6 slides, schema, noindex, ${scriptsChecked} scripts, ${localAssets.length} local assets.`);
console.log('Browser layout and interaction QA requires a working preview environment.');
