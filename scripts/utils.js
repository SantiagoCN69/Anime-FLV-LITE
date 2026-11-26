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
    const episodio = anime.episodio || anime.last_episode;
    const estado = anime.estado || anime.status;

    const chapterHtml = episodio ? `<span class="chapter">EP ${episodio}</span>` : '';
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
        estadoHtml = `<span class="estado">Episodio ${episodioUrl}</span>`;
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

    card.href = episodioUrl ? `/ver?id=${id}&episode=${episodioUrl}` : `/anime?id=${id}`;
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

// Desplaza un contenedor hasta dejar completamente visible la primera
// tarjeta cortada en el borde (snap por tarjeta, no por px fijos).
function scrollSnapPorTarjeta(container, dir, horizontal) {
  const cards = Array.from(container.children);
  if (!cards.length) return;

  // Propiedades del eje activo: horizontal (x) o vertical (y).
  const eje = horizontal
    ? { pos: 'offsetLeft', tam: 'offsetWidth', vista: 'clientWidth', total: 'scrollWidth', scroll: 'scrollLeft' }
    : { pos: 'offsetTop', tam: 'offsetHeight', vista: 'clientHeight', total: 'scrollHeight', scroll: 'scrollTop' };

  const limite = container[eje.vista];
  const maxScroll = Math.max(0, container[eje.total] - limite);
  const scrollActual = container[eje.scroll];

  const irA = (pos) => container.scrollTo(
    horizontal ? { left: pos, behavior: 'smooth' } : { top: pos, behavior: 'smooth' }
  );

  // Primera tarjeta que sobresale por el borde visible desde `desde`.
  const snapDesde = (desde) => {
    const cortada = cards.find(c => c[eje.pos] + c[eje.tam] > desde + limite + 1);
    return cortada ? Math.min(cortada[eje.pos], maxScroll) : null;
  };

  if (dir === 'next') {
    const destino = snapDesde(scrollActual);
    if (destino !== null && destino > scrollActual) irA(destino);
    return;
  }

  if (scrollActual <= 0) return;

  // Posiciones de snap alcanzables: 0 y el inicio de cada tarjeta cortada.
  const posiciones = [0];
  for (let actual = 0; actual < maxScroll;) {
    const siguiente = snapDesde(actual);
    if (siguiente === null || siguiente <= actual) break;
    posiciones.push(siguiente);
    actual = siguiente;
  }

  irA(posiciones.reverse().find(p => p < scrollActual - 1) ?? 0);
}

export function scrollFilaUnaTarjeta(container, dir) {
  scrollSnapPorTarjeta(container, dir, true);
}

// Igual que scrollFilaUnaTarjeta pero elige el eje según el layout actual:
// horizontal si el contenedor es una fila (flex-direction: row), vertical si no.
export function scrollContenedorUnaTarjeta(container, dir) {
  const horizontal = getComputedStyle(container).flexDirection === 'row';
  scrollSnapPorTarjeta(container, dir, horizontal);
}

// Convierte la rueda vertical en scroll horizontal, pero solo si el
// contenedor aún puede desplazarse en esa dirección; en los bordes el
// scroll pasa a la página para no atrapar el cursor.
// `condicion` (opcional) permite limitar cuándo aplica, p. ej. por viewport.
export function attachWheelScrollHorizontal(element, condicion = () => true) {
  if (!element) return;
  element.addEventListener('wheel', (evento) => {
    if (evento.deltaY === 0 || !condicion()) return;

    const maxScroll = element.scrollWidth - element.clientWidth;
    const puede = evento.deltaY > 0
      ? element.scrollLeft < maxScroll - 1
      : element.scrollLeft > 0;
    if (!puede) return;

    evento.preventDefault();
    element.scrollLeft += evento.deltaY;
  }, { passive: false });
}

//pildora visual check
export function mostrarPildora(mensaje, tipo = "default", onClick = null, duracion = 3000) {
  document.querySelector('.pildora')?.remove();

  const pill = document.createElement("div");
  pill.id = 'pildora-temporal';
  pill.className = `pildora pildora-${tipo}`;
  pill.textContent = mensaje;

  if (onClick) {
    // Una píldora clicable se descarta al usarla: ya cumplió su función.
    pill.classList.add("clicable");
    pill.onclick = () => {
      pill.remove();
      onClick();
    };
  }

  document.body.appendChild(pill);

  setTimeout(() => {
    pill.classList.add("saliendo");
    setTimeout(() => pill.remove(), 400);
  }, duracion);
}

let pillSwipeStart = null;
document.addEventListener("pointerdown", (e) => {
  pillSwipeStart = e.target.closest?.(".pildora")
    ? { x: e.clientX, y: e.clientY }
    : null;
});
document.addEventListener("pointerup", (e) => {
  if (!pillSwipeStart) return;
  const dx = e.clientX - pillSwipeStart.x;
  const dy = e.clientY - pillSwipeStart.y;
  pillSwipeStart = null;
  const pill = document.querySelector(".pildora");
  if (!pill) return;
  const vertical = Math.abs(dy) > Math.abs(dx);
  const dist = vertical ? dy : dx;
  if (Math.abs(dist) < 60) return;
  pill.style.setProperty("--desliz-x", vertical ? "0px" : `${dist > 0 ? "140px" : "-140px"}`);
  pill.style.setProperty("--desliz-y", vertical ? `${dist > 0 ? "140px" : "-140px"}` : "0px");
  pill.classList.add("deslizando");
  setTimeout(() => pill.remove(), 400);
});
document.addEventListener("pointercancel", () => { pillSwipeStart = null; });
