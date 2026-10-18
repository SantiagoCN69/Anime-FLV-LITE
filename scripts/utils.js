export function aplicarViewTransition(id, ratingHtml, clickedElement = null) {
  document.querySelectorAll('.anime-card.show a').forEach(card => {
    ['.container-img', 'strong', '.rating'].forEach(selector => {
      const el = card.querySelector(selector);
      if (el?.style.viewTransitionName) el.style.removeProperty('view-transition-name');
    });
  });

  if (clickedElement) {
    const strong = clickedElement.querySelector('strong');
    const containerImg = clickedElement.querySelector('.container-img');
    const rating = clickedElement.querySelector('.rating');

    if (strong) strong.style.setProperty('view-transition-name', 'title-' + id);
    if (containerImg) containerImg.style.setProperty('view-transition-name', 'cover-' + id);
    if (rating && ratingHtml) rating.style.setProperty('view-transition-name', 'rating-' + id);
  } else {
    if (ratingHtml) document.querySelectorAll("#anime-" + id + '.rating').forEach(el => el.style.setProperty('view-transition-name', 'rating-' + id));
    document.querySelectorAll('#anime-' + id + ' strong').forEach(el => el.style.setProperty('view-transition-name', 'title-' + id));
    document.querySelectorAll('#anime-' + id + ' .container-img').forEach(el => el.style.setProperty('view-transition-name', 'cover-' + id));
  }
}

const header = document.querySelector('header');
const sidebar = document.querySelector('.sidebar');
const indexpagination = document.querySelector('#indexpagination');
const scrollOffset = 30;

const handleScroll = () => {
  const shouldScroll = window.scrollY > scrollOffset && !document.body.classList.contains('animaciones-off');
  header.classList.toggle('scrolled', shouldScroll);
  sidebar.classList.toggle('scrolled', shouldScroll);
  indexpagination?.classList.toggle('scrolled', shouldScroll);
};

window.addEventListener('load', handleScroll);

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    handleScroll();
    ticking = false;
  });
}, { passive: true });

const animeCardObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('show');
      animeCardObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0, rootMargin: '0px 0px 150px 0px' });

/**
 * Observa una tarjeta individual o un grupo de tarjetas.
 * Pásale el elemento recién creado para evitar buscar en todo el DOM.
 * @param {Element | NodeList | Array} [target] - Opcional: elementos específicos a observar.
 */
export function observerAnimeCards(target) {
    if (document.body.classList.contains('animaciones-off')) return;

    // CASO 1: Si le pasas elementos directos (ej. al renderizar dinámicamente),
    // evitas por completo el costoso document.querySelectorAll global.
    if (target) {
        if (target instanceof Element) {
            if (!target.classList.contains('show') && !target.dataset.observed) {
                target.dataset.observed = "true";
                animeCardObserver.observe(target);
            }
        } else {
            target.forEach(card => {
                if (!card.classList.contains('show') && !card.dataset.observed) {
                    card.dataset.observed = "true";
                    animeCardObserver.observe(card);
                }
            });
        }
        return;
    }

    // CASO 2: Fallback global por si se llama sin parámetros (ej. carga inicial)
    const pendingCards = document.querySelectorAll(".anime-card:not(.show):not([data-observed])");
    for (let i = 0; i < pendingCards.length; i++) {
        const card = pendingCards[i];
        card.dataset.observed = "true";
        animeCardObserver.observe(card);
    }
}

// Si la página se cargó con las animaciones desactivadas, las tarjetas no pasan
// por el observador y se ven gracias a .animaciones-off. Al reactivarlas, deben
// conservarse visibles en lugar de volver a opacity: 0.
window.addEventListener('estadoAnimacionesCambiado', (event) => {
    if (!event.detail?.activas) return;

    document.querySelectorAll('.anime-card:not(.show)').forEach((card) => {
        animeCardObserver.unobserve(card);
        card.classList.add('show');
        delete card.dataset.observed;
    });

    handleScroll();
});

//INDICADOR funcion cambiar tema
document.addEventListener('authStateReady', function() {
  const btnLogin = document.getElementById('btn-login');
  // Verificar si hay un tema guardado
  if (!localStorage.getItem('theme')) {
    const theme = document.createElement('div');
    theme.classList.add('theme-indicator');
    btnLogin.appendChild(theme);
    btnLogin.addEventListener('click', () => {
      theme.remove();
      document.getElementById('theme-toggle').appendChild(theme);
    });
    document.getElementById('theme-toggle').addEventListener('click', () => {
      theme.remove();
    });
  }
});

export function crearAnimeCard(anime, opciones = {}) {
    const { episodioUrl = null, variant = 'default', onClick = null } = opciones;

    const titleText = anime.title || anime.titulo || anime.name || 'Título desconocido';
    let title = `<strong>${titleText}</strong>`;

    let id = anime.id;
    if (!id && anime.url) id = anime.url.replace(/\/$/, '').split('/').pop();
    if (!id && anime.cover) id = anime.cover.replace(/\/$/, '').split('/').pop().replace(/\.[^/.]+$/, '');
    if (!id) id = titleText.toLowerCase().trim().replace(/[\s\W-]+/g, '-');

    const coverImage = anime.cover || anime.image || anime.portada || anime.images?.webp?.image_url || 'img/loading.png';
    const rating = (anime.score || anime.rating)?.toString().split(/\s+/)[0];
    const type = anime.type;
    const capitulo = anime.Capitulo || anime.last_episode;
    const estado = anime.estado || anime.status;

    const chapterHtml = capitulo ? `<span class="chapter">EP ${capitulo}</span>` : '';
    const typeHtml = (type && type.toLowerCase() !== 'desconocido') ? `<span class="type">${type}</span>` : '';

    let estadoHtml = '';
    if (estado) {
        const estNormalizado = estado.toLowerCase().split(/\s+/)[0];
        let icon = 'circle-solid.svg';
        let textoEstado = "Finalizado";

        if (estNormalizado.includes('emisión') || estNormalizado.includes('emision') || estNormalizado.includes('currently') || estNormalizado === 'en') {
            icon = 'circle-solid-blue.svg';
            textoEstado = 'En emisión';
        } else if (estNormalizado.includes('estrenar') || estNormalizado.includes('proximamente') || estNormalizado.includes('por')) {
            icon = 'circle-solid-yellow.svg';
            textoEstado = 'Próximamente';
        }
        estadoHtml = `<span class="estado"><img src="../icons/${icon}" alt="${textoEstado}">${textoEstado}</span>`;
    } else if (episodioUrl && !estado) {
        estadoHtml = `<span class="estado">Capítulo ${episodioUrl}</span>`;
    }

    let ratingHtml = '';
    if (rating) {
        const formattedRating = Math.round(rating * 10) / 10;
        const displayRating = anime.score ? `${formattedRating}/10` : formattedRating;
        ratingHtml = `<span class="rating"><img src="../icons/star-solid.svg" alt="${formattedRating}">${displayRating}</span>`;
    }

    let extraTopHtml = '';
    let extraBottomHtml = '';
    if (variant === 'schedule') {
        const timeText = anime.time_ago || 'Sin última hora de emisión';
        extraTopHtml = `<div class="content" data-time_ago="${timeText}">`;
        extraBottomHtml = `</div>`;
    } else if (variant === 'jk') {
        extraBottomHtml = `<div class="content">${title}<p id="card-synopsis">${anime.synopsis || ""}</p></div>`;
        title = "";
    }

    const card = document.createElement('a');
    card.className = `anime-card ${variant === 'schedule' ? 'anime-card-schedule' : ''} ${variant === 'jk' ? 'anime-card-jk' : ''}`.trim();
    if (anime.day) card.dataset.day = anime.day;

    card.href = episodioUrl ? `/ver?id=${id}&episode=${episodioUrl}` : `/anime.html?id=${id}`;
    card.setAttribute('aria-label', episodioUrl ? `Ver ${titleText} episodio ${episodioUrl}` : `Ver ${titleText}`);

    card.innerHTML = `
        <div class="container-img">
            <img src="${coverImage}" class="cover" alt="${titleText}" loading="lazy">
            <img src="./icons/play-solid-trasparent.svg" class="play-icon" alt="play">
            ${chapterHtml}
            ${estadoHtml}
            ${ratingHtml}
            ${typeHtml}
        </div>
        ${extraTopHtml}
        ${title}
        ${extraBottomHtml}
    `;

    card.addEventListener('click', () => {
        if (typeof aplicarViewTransition === 'function') aplicarViewTransition(id, ratingHtml, card);
        if (onClick) onClick(anime);
    });

    return card;
}
