let ahorroBateriaForzandoAnimacionesOff = false;

const alEstarListoElBody = (callback) => {
    if (document.body) {
        callback();
    } else {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
    }
};

const aplicarEstadoAnimaciones = () => {
    const animacionesActivas = localStorage.getItem('animaciones') !== 'false';
    document.body.classList.toggle(
        'animaciones-off',
        ahorroBateriaForzandoAnimacionesOff || !animacionesActivas
    );
};

alEstarListoElBody(aplicarEstadoAnimaciones);

async function detectarAhorroEnergia() {
    if (!navigator.getBattery) {
        localStorage.setItem('ahorroBateriaActivo', 'false');
        return;
    }

    try {
        const battery = await navigator.getBattery();

        const verificarEstado = () => {
            const ahorroAutomaticoActivo = localStorage.getItem('ahorroBateriaAuto') !== 'false';
            const modoAhorroActivo = ahorroAutomaticoActivo && battery.level <= 0.20 && !battery.charging;

            ahorroBateriaForzandoAnimacionesOff = modoAhorroActivo;
            localStorage.setItem('ahorroBateriaActivo', String(modoAhorroActivo));
            
            window.dispatchEvent(new CustomEvent('estadoAhorroBateria', {
                detail: { activo: modoAhorroActivo }
            }));

            alEstarListoElBody(aplicarEstadoAnimaciones);
        };

        // Permite reevaluar inmediatamente cuando el usuario cambia el ajuste
        // de ahorro desde la pantalla de preferencias.
        window.addEventListener('configuracionAhorroBateriaCambiada', verificarEstado);

        verificarEstado();
        battery.addEventListener('chargingchange', verificarEstado);
        battery.addEventListener('levelchange', verificarEstado);
    } catch (e) {
        // Silenciar errores de restricciones del navegador
    }
}

detectarAhorroEnergia();
