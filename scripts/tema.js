(() => {
    const themes = {
        dark: {p: '#1F1F1F', b: '#121212', t1: '#fff', t2: '#ddd', br: '#444', btn: '#e76f51', f: 1, bgt: '255, 255, 255', bgti: '0, 0, 0'},
        nocturno: {p: '#1B263B', b: '#0D1B2A', t1: '#fff', t2: '#ddd', br: '#415A77', btn: '#12bedb', f: 1, bgt: '255, 255, 255', bgti: '0, 0, 0'},
        verde: {p: '#18221C',b: '#0F1612',t1: '#fff',t2: '#ddd',br: '#3C5143',btn: '#00FF99',f: 1,bgt: '255, 255, 255', bgti: '0, 0, 0'},
        neon: {p: '#1F1F2E',b: '#141422',t1: '#fff',t2: '#ddd',br: '#4A3A6A',btn: '#CEA5FF',f: 1,bgt: '255, 255, 255', bgti: '0, 0, 0'},
        light: {p: '#FAFAFA', b: '#F0F0F0', t1: '#111', t2: '#222', br: '#bbb', btn: '#FF3B3B', f: 2, bgt: '0, 0, 0', bgti: '255, 255, 255'},
        sakura: {p: '#FFF0F5', b: '#FFE4E1', t1: '#fff', t2: '#ddd', br: '#F8BBD0', btn: '#FF4081', f: 2, bgt: '0, 0, 0', bgti: '255, 255, 255'},
        cyberpunk: {p: '#0D0D0D', b: '#050505', t1: '#fff', t2: '#ddd', br: '#333333', btn: '#00FFE5', f: 1, bgt: '255, 255, 255', bgti: '0, 0, 0'},
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