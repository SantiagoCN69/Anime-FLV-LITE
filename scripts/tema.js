(() => {
    const themes = {
        dark: {
            p: '#18181b',
            b: '#09090b',
            t1: '#ffffff',
            t2: '#a1a1aa',
            br: '#27272a',
            btn: '#6366f1',
            btn2: '#8b5cf6',
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        nocturno: {
            p: '#131a2a',
            b: '#0b1120',
            t1: '#ffffff',
            t2: '#94a3b8',
            br: '#1e293b',
            btn: '#0ea5e9',
            btn2: '#38bdf8',
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        verde: {
            p: '#0f1c17',
            b: '#08130f',
            t1: '#ffffff',
            t2: '#86efac',
            br: '#1f3d32',
            btn: '#22c55e',
            btn2: '#00ff99',
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        neon: {
            p: '#1a1d29',
            b: '#0f1117',
            t1: '#ffffff',
            t2: '#9ca3af',
            br: '#1f2937',
            btn: '#a855f7',
            btn2: '#d63583',
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        sunset: {
            p: '#1c1917',
            b: '#0c0a09',
            t1: '#ffffff',
            t2: '#fdba74',
            br: '#292524',
            btn: '#f97316',
            btn2: '#fb7185',
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        sakura: {
            p: '#2a1622',
            b: '#140b12',
            t1: '#ffffff',
            t2: '#f9a8d4',
            br: '#3f1d35',
            btn: '#ec4899',
            btn2: '#f472b6',
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        },

        cyberpunk: {
            p: '#0a0a0f',
            b: '#050507',
            t1: '#ffffff',
            t2: '#67e8f9',
            br: '#1f1f23',
            btn: '#00f5ff',
            btn2: '#8b5cf6',
            f: 1,
            bgt: '255, 255, 255',
            bgti: '0, 0, 0'
        }
    };
    
    const applyTheme = t => {
        const theme = themes[t] || themes.dark;
        for (const [k, v] of Object.entries(theme)) {
            document.documentElement.style.setProperty(`--${k}`, v);
        }
    };

    applyTheme(localStorage.getItem('theme') || 'dark');

    addEventListener('storage', e => e.key === 'theme' && applyTheme(e.newValue || 'dark'));
    addEventListener('themeChanged', e => applyTheme(e.detail?.theme || 'dark'));
})();