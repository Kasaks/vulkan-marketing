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
matchMedia('(min-width: 1051px)').addEventListener('change', () => closeMenu());

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
  const dialog = document.getElementById(id);
  if (!(dialog instanceof HTMLDialogElement)) return;
  dialog.showModal();
  document.body.classList.add('modal-open');
}
document.querySelectorAll<HTMLElement>('[data-dialog-open]').forEach(trigger => trigger.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openDialog(trigger.dataset.dialogOpen || '');
}));
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => {
  dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => document.body.classList.toggle('modal-open', Boolean(document.querySelector('dialog[open]'))));
});
const gallery = document.querySelector<HTMLDialogElement>('#gallery-dialog');
if (gallery) {
  const galleryImage = gallery.querySelector('img');
  const thumbnails = Array.from(document.querySelectorAll<HTMLImageElement>('.case-gallery img'));
  let galleryIndex = 0;

  function showGalleryImage() {
    const thumbnail = thumbnails[galleryIndex];
    if (!galleryImage || !thumbnail) return;
    galleryImage.src = thumbnail.src;
    galleryImage.alt = thumbnail.alt;
  }

  function moveGallery(offset: number) {
    galleryIndex = (galleryIndex + offset + thumbnails.length) % thumbnails.length;
    showGalleryImage();
  }

  document.querySelectorAll<HTMLAnchorElement>('[data-gallery-open]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      galleryIndex = Number(link.dataset.imageIndex);
      showGalleryImage();
      openDialog(gallery.id);
    });
  });
  gallery.querySelector('[data-gallery-prev]')?.addEventListener('click', () => moveGallery(-1));
  gallery.querySelector('[data-gallery-next]')?.addEventListener('click', () => moveGallery(1));
  gallery.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    moveGallery(event.key === 'ArrowRight' ? 1 : -1);
  });
}
