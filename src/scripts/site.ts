const themeButton = document.querySelector<HTMLButtonElement>('.theme-toggle');
function syncTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeButton?.setAttribute('aria-pressed', String(dark));
  themeButton?.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e2028' : '#fbfaf7');
}
themeButton?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  syncTheme();
});
syncTheme();

const menuButton = document.querySelector<HTMLButtonElement>('.menu-toggle');
const nav = document.querySelector<HTMLElement>('#main-nav');
function closeMenu(returnFocus = false) {
  nav?.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Открыть меню');
  if (returnFocus) menuButton?.focus();
}
menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
  nav?.classList.toggle('is-open', expanded);
  menuButton.setAttribute('aria-expanded', String(expanded));
  menuButton.setAttribute('aria-label', expanded ? 'Закрыть меню' : 'Открыть меню');
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('click', event => {
  if (event.target instanceof Node && !nav?.contains(event.target) && !menuButton?.contains(event.target)) closeMenu();
});
matchMedia('(min-width: 761px)').addEventListener('change', () => closeMenu());

document.querySelectorAll<HTMLElement>('[data-carousel]').forEach(carousel => {
  const slides = Array.from(carousel.querySelectorAll<HTMLElement>('[data-slide]'));
  if (!slides.length) return;
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

// Fix the page in place while a dialog is open, including on touch devices.
let savedScroll = 0;
function lockScroll() {
  if (document.body.classList.contains('modal-open')) return;
  savedScroll = window.scrollY;
  document.body.classList.add('modal-open');
  document.body.style.top = `-${savedScroll}px`;
}
function unlockScroll() {
  if (document.querySelector('dialog[open]')) return;
  if (!document.body.classList.contains('modal-open')) return;
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  const root = document.documentElement;
  const scrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, savedScroll);
  root.style.scrollBehavior = scrollBehavior;
}
function openDialog(id: string) {
  const dialog = document.getElementById(id);
  if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;
  lockScroll();
  dialog.showModal();
}
document.querySelectorAll<HTMLElement>('[data-dialog-open]').forEach(trigger => trigger.addEventListener('click', event => {
  event.preventDefault();
  closeMenu();
  openDialog(trigger.dataset.dialogOpen || '');
}));
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => {
  dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    const backdrop = event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
    const gallerySpace = dialog.id === 'gallery-dialog' && event.target instanceof HTMLElement && event.target.matches('.gallery-shell, .gallery-stage, .gallery-stage figure');
    if (backdrop || gallerySpace) dialog.close();
  });
  dialog.addEventListener('close', () => queueMicrotask(unlockScroll));
});
document.querySelectorAll<HTMLAnchorElement>('[data-contact-from-service]').forEach(trigger => trigger.addEventListener('click', event => {
  event.preventDefault();
  trigger.closest('dialog')?.close();
  openDialog('contact-dialog');
}));

type GalleryImage = { src: string; alt: string; caption?: string };
const galleryDialog = document.querySelector<HTMLDialogElement>('#gallery-dialog');
const galleryImage = document.querySelector<HTMLImageElement>('#gallery-image');
const galleryCaption = document.querySelector<HTMLElement>('#gallery-caption');
const galleryCount = document.querySelector<HTMLElement>('[data-gallery-count]');
let galleryImages: GalleryImage[] = [];
let galleryActive = 0;
let galleryTrigger: HTMLElement | null = null;
function renderGallery() {
  const image = galleryImages[galleryActive];
  if (!image || !galleryImage) return;
  galleryImage.src = image.src;
  galleryImage.alt = image.alt;
  if (galleryCaption) galleryCaption.textContent = image.caption || image.alt;
  if (galleryCount) galleryCount.textContent = `${galleryActive + 1} / ${galleryImages.length}`;
  galleryDialog?.querySelectorAll<HTMLButtonElement>('[data-gallery-prev], [data-gallery-next]').forEach(button => { button.disabled = galleryImages.length < 2; });
}
function moveGallery(offset: number) {
  if (!galleryImages.length) return;
  galleryActive = (galleryActive + offset + galleryImages.length) % galleryImages.length;
  renderGallery();
}
document.querySelectorAll<HTMLElement>('[data-case-gallery]').forEach(gallery => {
  gallery.querySelectorAll<HTMLButtonElement>('[data-gallery-open]').forEach(trigger => trigger.addEventListener('click', () => {
    try { galleryImages = JSON.parse(gallery.dataset.galleryImages || '[]'); } catch { return; }
    if (!galleryImages.length) return;
    galleryActive = Math.min(Number(trigger.dataset.galleryOpen) || 0, galleryImages.length - 1);
    galleryTrigger = trigger;
    const title = document.getElementById('gallery-dialog-title');
    if (title) title.textContent = gallery.dataset.galleryTitle || 'Фотографии кейса';
    renderGallery();
    openDialog('gallery-dialog');
  }));
});
galleryDialog?.querySelector('[data-gallery-prev]')?.addEventListener('click', () => moveGallery(-1));
galleryDialog?.querySelector('[data-gallery-next]')?.addEventListener('click', () => moveGallery(1));
galleryDialog?.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); event.stopPropagation(); moveGallery(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
let galleryTouchX = 0, galleryTouchY = 0;
galleryDialog?.addEventListener('touchstart', event => {
  galleryTouchX = event.changedTouches[0].clientX;
  galleryTouchY = event.changedTouches[0].clientY;
}, { passive: true });
galleryDialog?.addEventListener('touchend', event => {
  const dx = event.changedTouches[0].clientX - galleryTouchX;
  const dy = event.changedTouches[0].clientY - galleryTouchY;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) moveGallery(dx < 0 ? 1 : -1);
}, { passive: true });
galleryDialog?.addEventListener('wheel', event => { event.preventDefault(); }, { passive: false });
galleryDialog?.addEventListener('close', () => {
  galleryImage?.removeAttribute('src');
  galleryTrigger?.focus({ preventScroll: true });
});
