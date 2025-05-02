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

    anime.episodes.forEach(ep => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "episode-btn";
      btn.textContent = `Episodio ${ep.number || ep.title || "desconocido"}`;
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
