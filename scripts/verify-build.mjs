import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
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
const pages = [home, blog, errorPage];
for (const slug of previewSlugs) {
  pages.push(await readOutput('blog/' + slug + '/index.html'));
}
const caseRoutes = ['tentovaya-produktsiya', 'myagkie-okna', 'stroymaterialy', 'raspil'];
for (const slug of caseRoutes) {
  const route = '/cases/' + slug + '/';
  assert.ok(home.includes('href="' + route + '"'), 'Missing case card: ' + slug);
  const casePage = await readOutput(route.slice(1) + 'index.html');
  assert.ok(casePage.includes('data-gallery-open'), 'Missing case gallery: ' + slug);
  pages.push(casePage);
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
assert.match(home, /class="formats-link" href="#services"/, 'Contacts link to formats');
assert.match(home, /href="\/blog\/kak-prodavat-tovary-na-avito-2026\/"/);
assert.match(blog, /Анонс материала/);
assert.match(blog, /Фотография будет добавлена/);
assert.match(pages[3], /Это анонс, а не полная статья/);
for (const slug of previewSlugs) {
  assert.ok(home.includes('href="/blog/' + slug + '/"'), 'Missing home card: ' + slug);
  assert.ok(blog.includes('href="/blog/' + slug + '/"'), 'Missing blog card: ' + slug);
}
assert.match(errorPage, /noindex, follow/);
const sitemap = await readOutput('sitemap.xml');
assert.ok(!sitemap.includes('<loc>'), 'Demo sitemap should remain empty');
console.log('Verified: homepage, blog archive, ' + previewSlugs.length + ' preview routes, ' + caseRoutes.length + ' cases, navigation, metadata, modals and local assets.');
console.log('Visual browser QA still needed.');
