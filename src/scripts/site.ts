const themeButton = document.querySelector<HTMLButtonElement>('.theme-toggle');
function syncTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeButton?.setAttribute('aria-pressed', String(dark));
  themeButton?.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101e25' : '#fcfaf8');
}
themeButton?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('vulkan-theme', next); } catch { /* Theme still works without storage. */ }
  syncTheme();
});
syncTheme();

const menuButton = document.querySelector<HTMLButtonElement>('.menu-toggle');
const mainNav = document.getElementById('main-nav');
if (menuButton && mainNav) {
  const mobileHeader = window.matchMedia('(max-width: 760px)');
  const isMenuExpanded = () => menuButton.getAttribute('aria-expanded') === 'true';
  const setMenuExpanded = (expanded: boolean) => menuButton.setAttribute('aria-expanded', String(expanded));

  menuButton.addEventListener('click', () => setMenuExpanded(!isMenuExpanded()));
  mainNav.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('a[href]')) setMenuExpanded(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !isMenuExpanded()) return;
    setMenuExpanded(false);
    if (!document.querySelector('dialog[open]')) menuButton.focus();
  });
  mobileHeader.addEventListener('change', event => {
    if (event.matches && mainNav.contains(document.activeElement)) menuButton.focus();
    setMenuExpanded(false);
  });

  document.documentElement.classList.add('mobile-menu-ready');
}

document.querySelectorAll<HTMLElement>('[data-carousel]').forEach(carousel => {
  const slides = Array.from(carousel.querySelectorAll<HTMLElement>('[data-slide]'));
  const counter = carousel.querySelector<HTMLElement>('[data-count]');
  let active = 0;
  const render = () => {
    slides.forEach((slide, index) => {
      slide.dataset.active = String(index === active);
      slide.setAttribute('aria-hidden', String(index !== active));
      slide.inert = index !== active;
    });
    if (counter) {
      counter.replaceChildren(document.createTextNode(String(active + 1).padStart(2, '0') + ' '));
      const total = document.createElement('span');
      total.textContent = '/ ' + String(slides.length).padStart(2, '0');
      counter.append(total);
      counter.setAttribute('aria-label', `${active + 1} из ${slides.length}`);
    }
  };
  const move = (offset: number) => { active = (active + offset + slides.length) % slides.length; render(); };
  carousel.querySelector('[data-prev]')?.addEventListener('click', () => move(-1));
  carousel.querySelector('[data-next]')?.addEventListener('click', () => move(1));
  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  let touchStartX = 0, touchStartY = 0;
  carousel.addEventListener('touchstart', event => { touchStartX = event.changedTouches[0].clientX; touchStartY = event.changedTouches[0].clientY; }, { passive: true });
  carousel.addEventListener('touchend', event => {
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  }, { passive: true });
  render();
});

function openDialog(id: string) {
  const dialog = document.getElementById(id) as HTMLDialogElement | null;
  if (typeof dialog?.showModal !== 'function') return false;
  if (!dialog.open) {
    dialog.showModal();
    document.body.classList.add('modal-open');
  }
  return true;
}
document.querySelectorAll<HTMLElement>('[data-dialog-open]').forEach(trigger => trigger.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (openDialog(trigger.dataset.dialogOpen || '')) event.preventDefault();
}));
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => {
  dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => document.body.classList.toggle('modal-open', Boolean(document.querySelector('dialog[open]'))));
});

const imageArticle = document.querySelector<HTMLElement>('[data-article-images]');
const imageDialog = document.querySelector<HTMLDialogElement>('#article-image-dialog');
const imageIndicator = document.querySelector<HTMLTemplateElement>('#article-image-indicator');
const imageViewport = imageDialog?.querySelector<HTMLElement>('.article-image-viewport');
const enlargedImage = imageViewport?.querySelector('img');
const imageCaption = imageDialog?.querySelector('figcaption');
const imageZoom = imageDialog?.querySelector<HTMLButtonElement>('[data-image-zoom]');
if (imageArticle && typeof imageDialog?.showModal === 'function' && imageIndicator && imageViewport && enlargedImage && imageCaption && imageZoom) {
  const captionFor = (image: HTMLImageElement) => image.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '';
  const setImageZoom = (zoomed: boolean) => {
    imageDialog.toggleAttribute('data-zoomed', zoomed);
    imageZoom.setAttribute('aria-pressed', String(zoomed));
    imageViewport.scrollTo(0, 0);
  };
  let imageTrigger: HTMLElement | null = null;

  imageArticle.querySelectorAll<HTMLImageElement>('.blog-article-cover img, #article img').forEach(image => {
    const subject = image.closest('picture') ?? image;
    if (subject.closest('a, button')) return;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'article-image-trigger';
    trigger.setAttribute('data-article-image', '');
    const label = image.alt || captionFor(image);
    trigger.setAttribute('aria-label', label ? `Увеличить изображение «${label}»` : 'Увеличить изображение');
    subject.replaceWith(trigger);
    trigger.append(subject, imageIndicator.content.cloneNode(true));
  });
  imageArticle.querySelectorAll('[data-article-image]').forEach(trigger => trigger.setAttribute('aria-haspopup', 'dialog'));

  imageArticle.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
    const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-article-image]') : null;
    const image = trigger?.querySelector('img');
    if (!trigger || !image) return;

    imageTrigger = trigger;
    enlargedImage.src = image.currentSrc || image.src;
    enlargedImage.alt = image.alt;
    const caption = captionFor(image);
    imageCaption.textContent = caption;
    imageCaption.hidden = !caption;
    setImageZoom(false);
    if (openDialog(imageDialog.id)) event.preventDefault();
    imageDialog.scrollTop = 0;
  });
  imageZoom.addEventListener('click', () => setImageZoom(!imageDialog.hasAttribute('data-zoomed')));
  imageDialog.addEventListener('close', () => imageTrigger?.focus({ preventScroll: true }));
}

function openLinkedCase() {
  const target = document.getElementById(window.location.hash.slice(1));
  if (target?.dataset.caseDialog && !document.querySelector('dialog[open]')) {
    openDialog(target.dataset.caseDialog);
  }
}

window.addEventListener('hashchange', openLinkedCase);
openLinkedCase();
