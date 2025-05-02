const params = new URLSearchParams(location.search);
const animeId = params.get("animeId");
const episodioUrl = decodeURIComponent(params.get("url") || "");
const btnVolver = document.getElementById("btn-volver-anime");
const tituloAnime = document.getElementById("titulo-anime");
btnVolver.href = `anime.html?id=${animeId}`;

// Obtener título del anime
async function obtenerTituloAnime() {
    try {
        const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/anime?id=${animeId}`);
        const data = await res.json();
        tituloAnime.textContent = data.title || "Anime";
        btnVolver.textContent = `Volver a ${data.title || "Anime"}`;
    } catch (error) {
        console.error("Error al obtener título del anime:", error);
        tituloAnime.textContent = "Anime";
        btnVolver.textContent = "Volver a Anime";
    }
}
obtenerTituloAnime();

const btnSiguiente = document.getElementById("btn-siguiente-capitulo");
const btnAnterior = document.getElementById("btn-anterior-capitulo");

let episodios = [];
let episodioActualIndex = -1;
let embeds = [];
let bloquearAnuncios = true;
let censuraActiva = false;

const btnBloquear = document.getElementById("btn-bloquear-anuncios");
const btnCensura = document.getElementById("btn-censura");
const reproductorContainer = document.querySelector(".reproductor-container");

btnBloquear.addEventListener("click", () => {
  bloquearAnuncios = !bloquearAnuncios;
  btnBloquear.textContent = `AdBlock: ${bloquearAnuncios ? "ON" : "OFF"}`;
  btnBloquear.classList.toggle("activo", bloquearAnuncios);
  const servidorActivo = document.querySelector("#controles .servidor-activo");
  if (embeds.length && servidorActivo) mostrarVideo(embeds[embeds.indexOf(servidorActivo.dataset.link)], servidorActivo);
});

btnCensura.addEventListener("click", () => {
  censuraActiva = !censuraActiva;
  btnCensura.textContent = `Censura: ${censuraActiva ? "ON" : "OFF"}`;
  btnCensura.classList.toggle("activo", censuraActiva);
  reproductorContainer.classList.toggle("censure", censuraActiva);
});

async function cargarEpisodios() {
  try {
    const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episodes?id=${animeId}`);
    const data = await res.json();
    episodios = data.episodes;
    episodioActualIndex = episodios.findIndex(ep => ep.url === episodioUrl);
    if (episodioActualIndex === -1) throw new Error("Episodio no encontrado");
    await cargarVideoDesdeEpisodio(episodioActualIndex);
    return episodios;
  } catch (err) {
    document.getElementById("video").innerHTML = "Error al cargar episodio.";
    console.error(err);
    return [];
  }
}

async function cargarVideoDesdeEpisodio(index) {
  const ep = episodios[index];
  const res = await fetch(`https://backend-animeflv-lite.onrender.com/api/episode?url=${encodeURIComponent(ep.url)}`);
  const data = await res.json();
  if (!data.servidores || !data.servidores.length) {
    document.getElementById("video").innerHTML = "No se encontraron servidores.";
    return;
  }

  embeds = data.servidores;
  episodioActualIndex = index;

  const btnCap = document.getElementById("btn-cap");
  btnCap.textContent = `Capítulo ${ep.number || ep.title || "desconocido"}`;

  history.replaceState({}, "", `ver.html?animeId=${animeId}&url=${encodeURIComponent(ep.url)}`);

  const controles = document.getElementById("controles");
  controles.innerHTML = "";
  embeds.forEach((srv, i) => {
    const btn = document.createElement("button");
    btn.textContent = `Servidor ${i + 1}`;
    btn.dataset.link = srv;
    btn.onclick = () => mostrarVideo(srv, btn);
    controles.appendChild(btn);
  });

  mostrarVideo(embeds[0], controles.querySelector("button"));
  return ep;
}

function mostrarVideo(link, botonSeleccionado) {
  const botones = document.querySelectorAll("#controles button");
  botones.forEach(btn => btn.classList.remove("servidor-activo"));
  if (botonSeleccionado) botonSeleccionado.classList.add("servidor-activo");

  const videoDiv = document.getElementById("video");
  videoDiv.innerHTML = "";

  if (link.endsWith(".mp4") || link.endsWith(".m3u8") || link.includes(".mp4?") || link.includes(".m3u8?")) {
    const video = document.createElement("video");
    video.src = link;
    video.controls = true;
    video.autoplay = true;
    video.width = "100%";
    video.height = "100%";
    video.style.maxHeight = "80vh";
    videoDiv.appendChild(video);
  } else {
    const iframe = document.createElement("iframe");
    iframe.src = link;
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.frameBorder = "0";
    iframe.allowFullscreen = true;
    iframe.scrolling = "no";

    if (!bloquearAnuncios) {
      iframe.removeAttribute("sandbox");
    } else {
      iframe.sandbox = "allow-scripts allow-same-origin allow-forms";
    }

    videoDiv.appendChild(iframe);
  }
}

function actualizarEstadoBotones() {
  btnAnterior.disabled = episodioActualIndex <= 0;
  btnAnterior.classList.toggle('desactivado', episodioActualIndex <= 0);

  btnSiguiente.disabled = episodioActualIndex >= episodios.length - 1;
  btnSiguiente.classList.toggle('desactivado', episodioActualIndex >= episodios.length - 1);
}

btnSiguiente.addEventListener("click", e => {
  e.preventDefault();
  if (episodioActualIndex < episodios.length - 1) {
    cargarVideoDesdeEpisodio(episodioActualIndex + 1).then(actualizarEstadoBotones);
  }
});

btnAnterior.addEventListener("click", e => {
  e.preventDefault();
  if (episodioActualIndex > 0) {
    cargarVideoDesdeEpisodio(episodioActualIndex - 1).then(actualizarEstadoBotones);
  }
});

cargarEpisodios().then(actualizarEstadoBotones);