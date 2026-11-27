import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('dist');
const readOutput = path => readFile(resolve(root, path), 'utf8');
const home = await readOutput('index.html');
const blog = await readOutput('blog/index.html');
const errorPage = await readOutput('404.html');
const previewSlugs = [
  'kak-prodavat-tovary-na-avito-2026',
  'ves-obyavleniya-i-profilya-na-avito',
  'analiz-statistiki-obyavleniy-na-avito'
];
const publishedSlugs = (await readdir('src/content/blog', { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
  .map(entry => entry.name.slice(0, -3));
assert.ok(publishedSlugs.length, 'The blog has published articles');
const articleSlugs = new Set([...publishedSlugs, ...previewSlugs]);
assert.equal(articleSlugs.size, publishedSlugs.length + previewSlugs.length, 'Article slugs are unique');
const pages = [home, blog, errorPage];
for (const slug of previewSlugs) {
  pages.push(await readOutput('blog/' + slug + '/index.html'));
}
const publishedDates = new Map();
for (const slug of publishedSlugs) {
  const html = await readOutput('blog/' + slug + '/index.html');
  const date = html.match(/<time datetime="(\d{4}-\d{2}-\d{2})"/)?.[1];
  assert.ok(date, 'Missing publication date: ' + slug);
  assert.match(html, /"@type":"BlogPosting"/, 'Missing BlogPosting metadata: ' + slug);
  assert.match(html, /class="blog-text-section blog-markdown"/, 'Missing article body: ' + slug);
  assert.match(html, /<img[^>]* src="\/images\/blog\//, 'Missing article photos: ' + slug);
  assert.doesNotMatch(html, /Оригинальная фотография ожидается/, 'Unexpected cover placeholder: ' + slug);
  publishedDates.set(slug, date);
  pages.push(html);
}
const caseScreenshots = {
  'tentovaya-produktsiya': [1, 2, 3, 4],
  'myagkie-okna': [5, 8, 9, 10],
  'stroymaterialy': [6],
  'raspil': [7, 11, 12, 13],
};
for (const [slug, expectedShots] of Object.entries(caseScreenshots)) {
  const anchor = 'case-' + slug;
  const preview = home.match(new RegExp('<article[^>]* id="' + anchor + '"[^>]*>([\\s\\S]*?)</article>'))?.[1];
  assert.ok(preview?.includes('data-dialog-open="' + anchor + '-dialog"'), 'Missing case preview: ' + slug);
  const screenshots = content => Array.from(content.matchAll(/<img[^>]* src="\/images\/cases\/(\d+)\.png"/g), match => Number(match[1]));
  assert.deepEqual(screenshots(preview), expectedShots.slice(0, 1), 'First screenshot on homepage: ' + slug);
  const dialog = home.match(new RegExp('<dialog[^>]* id="' + anchor + '-dialog"[^>]*>([\\s\\S]*?)</dialog>'))?.[1];
  assert.ok(dialog, 'Missing case dialog: ' + slug);
  assert.deepEqual(screenshots(dialog), expectedShots, 'Case story image order: ' + slug);
  assert.match(dialog, /<p\b[^>]*>[^<]+<\/p>[\s\S]+<figure\b[^>]*>[\s\S]+<\/figure>[\s\S]+<p\b/, 'Case story has text before and after its first screenshot');
  const redirect = await readOutput('cases/' + slug + '/index.html');
  assert.ok(redirect.includes('content="0;url=/#' + anchor + '"'), 'Legacy case redirects to its homepage anchor: ' + slug);
}
for (let i = 0; i < pages.length; i++) {
  const html = pages[i];
  assert.match(html, /<html[^>]*lang="ru"/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, 'Exactly one main heading on page ' + i);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /name="description"/);
  assert.match(html, /name="robots" content="noindex, follow"/, 'Demo mode must remain noindex');
  assert.match(html, /href="\/blog\/"/);
  assert.match(html, /id="contact-dialog"/);
  const menuToggle = html.match(/<button\b[^>]*class="menu-toggle\b[^"]*"[^>]*>/)?.[0];
  assert.ok(menuToggle, 'Missing mobile navigation toggle on page ' + i);
  assert.match(menuToggle, /type="button"/);
  assert.match(menuToggle, /aria-label="[^"]+"/);
  assert.match(menuToggle, /aria-expanded="false"/);
  assert.match(menuToggle, /aria-controls="main-nav"/);
  assert.match(html, /<nav id="main-nav"/);
  assert.ok(!/<form\b/i.test(html), 'No contact forms');
  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'No duplicated ID in page ' + i);
  const schemaText = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(schemaText, 'Missing structured data');
  const schema = JSON.parse(schemaText);
  assert.equal(schema['@context'], 'https://schema.org');
  assert.ok(!schemaText.includes('AggregateRating'), 'No unverified ratings');
  for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(html.includes('id="' + target + '"'), 'Missing internal target ' + target);
  }
  for (const [, slug] of html.matchAll(/href="\/blog\/([^"/]+)\/"/g)) {
    assert.ok(articleSlugs.has(slug), 'Missing article route: ' + slug);
  }
  for (const [, target] of html.matchAll(/data-dialog-open="([^"]+)"/g)) {
    assert.ok(html.includes('id="' + target + '"'), 'Missing modal ' + target);
  }
  const localAssets = Array.from(html.matchAll(/(?:src|href)="(\/(?:_astro|images)\/[^"?#]+)"/g), match => match[1]);
  for (const asset of localAssets) {
    assert.ok((await stat(resolve(root, '.' + asset))).isFile(), 'Missing asset: ' + asset);
  }
}
assert.match(home, /Форматы сотрудничества/);
const sectionOrder = ['work-cycle', 'cases', 'expertise', 'reviews', 'discuss', 'methods', 'contact', 'services', 'blog'];
const homeSections = Array.from(home.matchAll(/<section\b[^>]* id="([^"]+)"/g), match => match[1]);
assert.deepEqual(homeSections, sectionOrder, 'Homepage sections follow the agreed order');
const mainMenu = home.match(/<nav id="main-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
const footerMenu = home.match(/<footer\b[\s\S]*?<nav[^>]*>([\s\S]*?)<\/nav>/)?.[1];
assert.ok(mainMenu && footerMenu, 'Both menus are present');
assert.equal(mainMenu, footerMenu, 'Header and footer menus match');
assert.match(mainMenu, /<a href="\/blog\/">Блог<\/a>/);
const discussion = home.match(/<section[^>]* id="discuss"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
const contacts = home.match(/<section[^>]* id="contact"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
assert.match(discussion, /class="formats-link" href="#services"/, 'Discussion links to formats');
assert.ok(!contacts.includes('href="#services"'), 'Formats link has moved out of contacts');
assert.match(home, /Мы ставим перед собой три основные задачи/);
assert.match(home, /Как мы добиваемся <em[^>]*>лучших показателей<\/em>/);
assert.match(home, /Вот что у нас получается/);
assert.match(home, /Фабрика тентовой продукции из Кирова/);
const formatSection = home.match(/<section[^>]* id="services"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
for (const question of [
  'А какой запрос у вас?',
  'Хотите передать ведение проекта?',
  'Нужен тест ниши или быстрый запуск Авито?',
  'Хотите освоить автозагрузку?',
]) {
  assert.ok(formatSection.includes(question), 'Missing format call to action: ' + question);
}
assert.doesNotMatch(blog, /Анонс материала|Фотография будет добавлена|Сейчас представлены анонсы|Перейти на канал в Дзене/);
assert.match(blog, /id="blog-archive-title">Материалы<\/h2>/);
for (const html of pages.slice(3, 3 + previewSlugs.length)) {
  assert.match(html, /Это анонс, а не полная статья/);
}
const publishedCards = [...publishedSlugs]
  .sort((a, b) => publishedDates.get(b).localeCompare(publishedDates.get(a)))
  .map(slug => ({ slug, date: publishedDates.get(slug) }));
const cards = html => Array.from(
  html.matchAll(/class="article-card-link" href="\/blog\/([^"]+)\/"[^>]*>([\s\S]*?)<\/a>/g),
  ([, slug, body]) => ({
    slug,
    date: body.match(/<time class="article-card-date" datetime="(\d{4}-\d{2}-\d{2})">[^<]+<\/time>/)?.[1],
  }),
);
assert.deepEqual(cards(home), publishedCards.slice(0, 3), 'Latest articles and dates on the homepage');
assert.deepEqual(cards(blog), publishedCards, 'Published articles and dates in the archive');
assert.equal((blog.match(/<img[^>]* src="\/images\/blog\//g) || []).length, publishedCards.length, 'Cover on every archive card');
assert.match(errorPage, /noindex, follow/);
const sitemap = await readOutput('sitemap.xml');
assert.ok(!sitemap.includes('<loc>'), 'Demo sitemap should remain empty');
console.log('Verified: homepage, blog archive, ' + publishedSlugs.length + ' articles, ' + previewSlugs.length + ' previews, ' + Object.keys(caseScreenshots).length + ' cases, navigation, metadata, modals and local assets.');
console.log('Visual browser QA still needed.');
