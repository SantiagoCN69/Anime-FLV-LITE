(() => {
const themes = {

    nocturno: {
    p: '#121A2B',
    b: '#0A0F1C',
    t1: '#EEF2F8',
    t2: '#7FC4D6',
    br: '#243049',
    btn: '#3F6FD8',
    btn2: '#2D8CA6',
    bgt: '238, 242, 248',
    bgti: '10, 15, 28'
    },

    sakura: {
    p: '#201A1E',
    b: '#121013',
    t1: '#F4EEF0',
    t2: '#E0A3B5',
    br: '#3A2E34',
    btn: '#B54A6F',
    btn2: '#C2705F',
    bgt: '244, 238, 240',
    bgti: '18, 16, 19'
    },

    anizen: {
    p: '#1A1622',
    b: '#0E0B14',
    t1: '#F2EEF6',
    t2: '#BFA3DD',
    br: '#302838',
    btn: '#a970ff',     
    btn2: '#B8688F',
    bgt: '242, 238, 246',
    bgti: '14, 11, 20'
    },

ambar: {
    p: '#1B1613',
    b: '#100D0B',
    t1: '#F2EDE8',
    t2: '#E8A25C',
    br: '#322A24',
    btn: '#D9692A',
    btn2: '#B5833A',
    bgt: '242, 237, 232',
    bgti: '16, 13, 11'
    }
};

    // CORRECCIÓN CRÍTICA: Cambiado el default a un tema existente
    const DEFAULT_THEME = 'sakura';

    const applyTheme = t => {
        const clave = themes[t] ? t : DEFAULT_THEME;
        const theme = themes[clave];
        if (!theme) return;

        for (const [k, v] of Object.entries(theme)) {
            if (v !== undefined && v !== null) {
                document.documentElement.style.setProperty(`--${k}`, v);
            }
        }

        // Favicon según el tema activo (icon-{tema}.png en el worker)
        // Se reemplaza el <link> y se añade ?v= para forzar la recarga en cada visita
        const urlIcono = `https://ani.zenlite.workers.dev/icons/temas/favicon-${clave}.png?v=${Date.now()}`;
        document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(icono => {
            const nuevo = icono.cloneNode();
            nuevo.href = urlIcono;
            icono.replaceWith(nuevo);
        });
    };

    applyTheme(localStorage.getItem('theme') || DEFAULT_THEME);

    addEventListener('storage', e => e.key === 'theme' && applyTheme(e.newValue || DEFAULT_THEME));
    addEventListener('themeChanged', e => applyTheme(e.detail?.theme || DEFAULT_THEME));

    window.AniZenThemes = { themes, applyTheme, DEFAULT_THEME };
})();