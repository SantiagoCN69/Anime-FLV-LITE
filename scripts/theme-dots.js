// Selector de temas con círculos de color. Requiere scripts/tema.js cargado
// (expone window.AniZenThemes); si no está, usa colores de respaldo.
const DEFAULT_THEME = 'sakura';
const FALLBACK_ORDER = ['nocturno', 'sakura', 'anime_zen', 'ambar'];
const FALLBACK_COLORS = {
  nocturno: '#3F6FD8',
  sakura: '#B54A6F',
  anime_zen: '#a970ff',
  ambar: '#D9692A',
};
const LABELS = {
  nocturno: 'Nocturno',
  sakura: 'Sakura',
  anime_zen: 'Anime Zen',
  ambar: 'Ambar',
};

const getThemes = () => window.AniZenThemes?.themes || null;

const getOrder = () => {
  const themes = getThemes();
  return themes ? Object.keys(themes) : FALLBACK_ORDER;
};

export const currentTheme = () => {
  const guardado = localStorage.getItem('theme');
  return getOrder().includes(guardado) ? guardado : DEFAULT_THEME;
};

const applyInstant = (theme) => {
  if (window.AniZenThemes?.applyTheme) {
    window.AniZenThemes.applyTheme(theme);
  } else {
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  }
};

const persistTheme = (theme) => {
  localStorage.setItem('theme', theme);
  window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
};

export function mountThemeDots(container, { onSelect } = {}) {
  if (!container) return;
  container.innerHTML = '';
  container.classList.add('theme-dots');

  const themes = getThemes();
  const order = getOrder();

  const markActive = () => {
    const actual = currentTheme();
    container.querySelectorAll('.theme-dot').forEach(dot => {
      dot.classList.toggle('active', dot.dataset.theme === actual);
    });
  };

  order.forEach(name => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-dot';
    btn.dataset.theme = name;
    btn.title = LABELS[name] || name;
    btn.style.background = themes?.[name]?.btn || FALLBACK_COLORS[name] || '#888';

    let previewPrev = null;

    btn.addEventListener('mouseenter', () => {
      previewPrev = currentTheme();
      applyInstant(name);
    });
    btn.addEventListener('mouseleave', () => {
      if (previewPrev !== null) {
        applyInstant(previewPrev);
        previewPrev = null;
      }
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      previewPrev = null;
      persistTheme(name);
      markActive();
      onSelect?.(name);
    });

    container.appendChild(btn);
  });

  markActive();

  window.addEventListener('themeChanged', markActive);
  window.addEventListener('storage', (e) => { if (e.key === 'theme') markActive(); });
}
