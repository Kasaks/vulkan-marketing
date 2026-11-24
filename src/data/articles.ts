import type { MarkdownInstance } from 'astro';

export type ArticleSection = {
  heading?: string;
  paragraphs: string[];
  images?: string[];
};

type ArticleMetadata = {
  slug: string;
  title: string;
  excerpt: string;
  images: string[];
  originalUrl: string;
  publishedAt?: string;
};

type MarkdownArticle = Omit<ArticleMetadata, 'slug'> & {
  publishedAt: string;
  coverInBody?: boolean;
  coverCaption?: string;
  coverWidth: number;
  coverHeight: number;
};

export type BlogArticle = ArticleMetadata & {
  status: 'preview' | 'published';
  sections: ArticleSection[];
  previewParagraphs: string[];
  coverInBody?: boolean;
  coverCaption?: string;
  coverWidth?: number;
  coverHeight?: number;
  Content?: MarkdownInstance<MarkdownArticle>['Content'];
};

export const dzenChannelUrl = 'https://dzen.ru/vulkan_marketing';

const previews: BlogArticle[] = [
  {
    slug: 'kak-prodavat-tovary-na-avito-2026',
    title: 'Как продавать на Авито товары в 2026 году?',
    excerpt: 'Разберем в нашей статье, она поможет не действовать наугад, а сконцентрироваться на целевых действиях',
    status: 'preview',
    images: [],
    sections: [],
    previewParagraphs: [
      'В статье вы узнаете: что нужно для старта? Какую выбрать стратегию продвижения и постинга? Как оценить результаты и повысить эффективность?',
      'Мы собрали свой опыт и методы запуска товаров на Авито и поделились им с вами, спасибо за ваши лайки и комментарии'
    ],
    originalUrl: dzenChannelUrl
  },
  {
    slug: 'ves-obyavleniya-i-profilya-na-avito',
    title: 'Вес объявления и вес профиля на Авито',
    excerpt: 'Слышали понятие "Вес объявления" или "Вес профиля"? Если не слышали, то наверняка слышали про алгоритмы ранжирования, они есть у любой поисковой системы, и у Авито в том числе',
    status: 'preview',
    images: [],
    sections: [],
    previewParagraphs: [
      'Нам никто не расскажет какие параметры наших профилей и объявлений влияют места в выдаче сайта, но на различных конференциях, вебинарах информация все же просачивается',
      'От того со временем сформировалась необходимость комплексного подхода к ведению, это значит что не стоит выкладывать объявления в незаполненный профиль, не включать Авито доставку и так далее',
      'Я собрал некоторые советы чтобы повысить вес вашего профиля и объявлений в этой статье на Дзене'
    ],
    originalUrl: dzenChannelUrl
  },
  {
    slug: 'analiz-statistiki-obyavleniy-na-avito',
    title: 'Анализ статистики объявлений на Авито',
    excerpt: 'Поднять эффективность объявлений на Авито можно в несколько действий',
    status: 'preview',
    images: [],
    sections: [],
    previewParagraphs: [
      'Главное найти точки к которым стоит приложить силы для повышения этой эффективности',
      'Найти такие точки можно через Анализ статистики, это тема новой статьи на Дзене, которая уже доступна'
    ],
    originalUrl: dzenChannelUrl
  }
];

const markdownModules = import.meta.glob<MarkdownInstance<MarkdownArticle>>(
  '../content/blog/*.md',
  { eager: true },
);

const published = Object.entries(markdownModules)
  .map(([file, { frontmatter, Content }]) => ({
    ...frontmatter,
    slug: file.slice(file.lastIndexOf('/') + 1, -3),
    Content,
    status: 'published' as const,
    sections: [],
    previewParagraphs: [],
  }))
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export const articles: BlogArticle[] = [...published, ...previews];

export const latestArticles = (count = 3): BlogArticle[] =>
  articles.slice(0, count);
