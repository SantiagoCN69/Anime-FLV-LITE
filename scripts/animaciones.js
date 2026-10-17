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

// Aplica la preferencia manual incluso si Battery API no está disponible.
alEstarListoElBody(aplicarEstadoAnimaciones);

// Detectar ahorro de energía usando Battery API
async function detectarAhorroEnergia() {
    console.log('[Ahorro Batería] Iniciando detección...');

    // 1. Validar si el navegador soporta la API
    if (!('getBattery' in navigator)) {
        console.warn("[Ahorro Batería] La Battery API no es compatible con este navegador.");
        localStorage.setItem('ahorroBateriaActivo', 'false');
        return false;
    }

    try {
        console.log("[Ahorro Batería] Obteniendo estado de batería...");
        const battery = await navigator.getBattery();
        console.log("[Ahorro Batería] Battery API obtenida correctamente");

        // El ahorro automático es una anulación temporal; nunca cambia la
        // preferencia manual almacenada en `animaciones`.
        const verificarEstado = () => {
            const ahorroAutomaticoActivo = localStorage.getItem('ahorroBateriaAuto') !== 'false';
            const estaCargando = battery.charging;
            const nivelBateria = battery.level;
            const nivelBateriasBajo = nivelBateria <= 0.20; // 20% o menos

            console.log('[Ahorro Batería] Estado - Automático:', ahorroAutomaticoActivo, 'Cargando:', estaCargando, 'Nivel:', (nivelBateria * 100).toFixed(0) + '%', 'Baja:', nivelBateriasBajo);

            // Consideramos "ahorro" si la batería es baja y NO está enchufado
            const modoAhorroActivo = ahorroAutomaticoActivo && nivelBateriasBajo && !estaCargando;

            ahorroBateriaForzandoAnimacionesOff = modoAhorroActivo;
            localStorage.setItem('ahorroBateriaActivo', String(modoAhorroActivo));
            window.dispatchEvent(new CustomEvent('estadoAhorroBateria', {
                detail: { activo: modoAhorroActivo }
            }));

            if (modoAhorroActivo) {
                console.log("[Ahorro Batería] ✓ Animaciones pausadas temporalmente por batería baja");
            } else {
                console.log("[Ahorro Batería] Aplicando preferencia manual de animaciones");
            }
            alEstarListoElBody(aplicarEstadoAnimaciones);
        };

        // Ejecutar al iniciar
        verificarEstado();

        // Escuchar cambios en tiempo real (si el usuario conecta el cargador o baja el nivel)
        battery.addEventListener('chargingchange', verificarEstado);
        battery.addEventListener('levelchange', verificarEstado);

        console.log("[Ahorro Batería] Listeners activados");

    } catch (error) {
        console.error("[Ahorro Batería] Error al obtener el estado de la batería:", error);
    }
}

detectarAhorroEnergia();
