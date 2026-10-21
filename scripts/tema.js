(() => {
const themes = {

    nocturno: {
        p: '#0f172a',
        b: '#020617',
        t1: '#f1f5f9',
        t2: '#38bdf8',
        br: '#1e293b',       // Borde más sutil (Slate 800) en lugar del slate claro
        btn: '#3b82f6',
        btn2: '#0ea5e9',     // Cian saturado para evitar degradados deslavados
        bgt: '255, 255, 255',
        bgti: '2, 6, 23'
    },

    sakura: {
        p: '#2D1B22',       
        b: '#170B11',       
        t1: '#fdf2f8',
        t2: '#f472b6',
        br: '#4A2A38',      
        btn: '#d21e6e',
        btn2: '#ff7a7a',
        bgt: '255, 255, 255',
        bgti: '23, 11, 17'  
    },

    gris_cian: {
        p: '#27272A',       
        b: '#18181B',       
        t1: '#F8FAFC',
        t2: '#2DD4BF',      
        br: '#3F3F46',      
        btn: '#0D9488',     
        btn2: '#34D399',    
        bgt: '255, 255, 255',
        bgti: '24, 24, 27'  
    },

    anime_zen: {
        p: '#111114',       
        b: '#09090b',       
        t1: '#f8f5ff',      
        t2: '#bd83f2',      
        br: '#1C1C20',      
        btn: '#a970ff',     
        btn2: '#ed65b5',    
        bgt: '255, 255, 255',
        bgti: '9, 9, 11'    
    },
};

    // CORRECCIÓN CRÍTICA: Cambiado el default a un tema existente
    const DEFAULT_THEME = 'anime_zen';

    const applyTheme = t => {
        const theme = themes[t] || themes[DEFAULT_THEME];
        if (!theme) return;

        for (const [k, v] of Object.entries(theme)) {
            if (v !== undefined && v !== null) {
                document.documentElement.style.setProperty(`--${k}`, v);
            }
        }
    };

    applyTheme(localStorage.getItem('theme') || DEFAULT_THEME);

    addEventListener('storage', e => e.key === 'theme' && applyTheme(e.newValue || DEFAULT_THEME));
    addEventListener('themeChanged', e => applyTheme(e.detail?.theme || DEFAULT_THEME));
})();