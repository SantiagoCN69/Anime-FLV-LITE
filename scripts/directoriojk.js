import { mostrarSeccionDesdesearch } from './index.js';

document.getElementById('btn-fuente-directorio-JK').addEventListener('click', () => {
   history.replaceState(null, '', `?DirectorioFLV`);
   mostrarSeccionDesdesearch();
});

