const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Simulación de base de datos de capítulos (reemplazar con tu fuente de datos real)
const animesData = {
    'anime1': [
        { id: 1, url: 'enlace1' },
        { id: 2, url: 'enlace2' },
        { id: 3, url: 'enlace3' }
    ],
    'anime2': [
        { id: 1, url: 'enlace4' },
        { id: 2, url: 'enlace5' },
        { id: 3, url: 'enlace6' }
    ]
};

// Endpoint para obtener el siguiente capítulo
app.get('/next-episode', (req, res) => {
    const { animeId, currentEpisode } = req.query;
    
    if (!animeId || !currentEpisode) {
        return res.status(400).json({ error: 'Faltan parámetros' });
    }

    const episodeList = animesData[animeId];
    
    if (!episodeList) {
        return res.status(404).json({ error: 'Anime no encontrado' });
    }

    const currentEpisodeIndex = episodeList.findIndex(ep => ep.id === parseInt(currentEpisode));
    
    if (currentEpisodeIndex === -1) {
        return res.status(404).json({ error: 'Capítulo no encontrado' });
    }

    const nextEpisode = episodeList[currentEpisodeIndex + 1];
    
    if (!nextEpisode) {
        return res.status(404).json({ error: 'No hay más capítulos' });
    }

    res.json({
        nextEpisode: {
            id: nextEpisode.id,
            url: nextEpisode.url
        }
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
