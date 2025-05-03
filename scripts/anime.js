const id = new URLSearchParams(location.search).get("id");

document.getElementById("descripcion").innerHTML = '<div class="loading">Cargando información...</div>';

fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${id}`)
  .then(res => res.json())
  .then(anime => {
    document.getElementById("titulo").textContent = anime.title;
    document.getElementById("portada").src = anime.cover;
    document.body.style.backgroundImage = `url(${anime.cover})`;
    document.getElementById("descripcion").textContent = anime.synopsis;

    const capContenedor = document.getElementById("capitulos");
    const filtroCapitulo = document.getElementById("filtro-capitulo");

    // Scroll horizontal con la rueda del mouse
    capContenedor.addEventListener("wheel", function (e) {
      e.preventDefault();
      const columnas = this.querySelectorAll("li");
      if (columnas.length === 0) return;
      const anchoColumna = columnas[0].offsetWidth;
      const direccion = e.deltaY > 0 ? 1 : -1;
      const scrollActual = this.scrollLeft;
      const columnaActual = Math.floor(scrollActual / anchoColumna);
      const nuevoScroll = (columnaActual + direccion) * anchoColumna;
      const scrollMaximo = (columnas.length - 1) * anchoColumna;
      this.scrollLeft = Math.max(0, Math.min(nuevoScroll, scrollMaximo));
    }, { passive: false });

    // Filtro de capítulos
    filtroCapitulo.addEventListener("input", function () {
      const filtro = this.value.toLowerCase();
      const botones = capContenedor.querySelectorAll(".episode-btn");
      let primerCoincidencia = null;

      botones.forEach((btn, index) => {
        const texto = btn.textContent.toLowerCase();
        const coincide = texto.includes(filtro);
        if (coincide && primerCoincidencia === null) primerCoincidencia = index;
      });

      if (primerCoincidencia !== null) {
        const elemento = botones[primerCoincidencia].parentElement;
        elemento.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    // Cargar vistos desde localStorage
    const vistos = cargarEstado();

    // Crear botones de episodios
    anime.episodes.forEach(ep => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "episode-btn ep-no-visto";
      btn.textContent = `Episodio ${ep.number || ep.title || "desconocido"}`;

      // Verifica si ya fue marcado como visto
      if (vistos[ep.number]) {
        btn.classList.remove("ep-no-visto");
        btn.classList.add("ep-visto");
      }

      // Ícono de visto/no visto
      const icon = document.createElement("img");
icon.className = "icon-eye";
icon.src = vistos[ep.number] ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
icon.alt = "visto";

icon.onclick = (e) => {
  e.stopPropagation();
  const esVisto = btn.classList.toggle("ep-visto");
  btn.classList.toggle("ep-no-visto");
  icon.src = esVisto ? "/icons/eye-solid.svg" : "/icons/eye-slash-solid.svg";
  guardarEstado(ep.number, esVisto);
};



      btn.appendChild(icon);

      // Al hacer clic en el botón, redirigir al episodio
      btn.onclick = () => {
        window.location.href = `ver.html?animeId=${id}&url=${encodeURIComponent(ep.url)}`;
      };

      li.appendChild(btn);
      capContenedor.appendChild(li);
    });
  })
  .catch(err => {
    console.error("Error al cargar datos del anime:", err);
    document.getElementById("descripcion").textContent = "Error al cargar el anime.";
  });

// Toggle búsqueda de capítulos
document.getElementById('btn-search-capitulo').addEventListener('click', function () {
  document.querySelector('.header-caps').classList.add('search-active');
  document.getElementById('filtro-capitulo').focus();
});

// Cerrar búsqueda de capítulos
document.getElementById('btn-close-search-capitulo').addEventListener('click', function () {
  document.querySelector('.header-caps').classList.remove('search-active');
  document.getElementById('filtro-capitulo').value = "";
});

// Altura del container 1
document.addEventListener('DOMContentLoaded', () => {
  function setContainerHeight() {
    const container1 = document.querySelector('.anime-container1');
    if (container1) {
      const height = container1.offsetHeight;
      document.documentElement.style.setProperty('--altura-container-1', `${height}px`);
    }
  }

  setContainerHeight();
  window.addEventListener('resize', setContainerHeight);
});

// Funciones para localStorage
function guardarEstado(epNum, visto) {
  const clave = `anime-${id}`;
  const data = JSON.parse(localStorage.getItem(clave)) || {};
  data[epNum] = visto;
  localStorage.setItem(clave, JSON.stringify(data));
}

function cargarEstado() {
  const clave = `anime-${id}`;
  return JSON.parse(localStorage.getItem(clave)) || {};
}
