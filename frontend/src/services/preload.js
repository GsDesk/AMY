// Descarga del código de las pantallas protegidas. Vite cachea la promesa, así que
// llamar aquí antes de navegar hace que la pantalla aparezca sin esperar la descarga.
export const loadChatPage = () => import('../pages/ChatPage');
export const loadAdminPage = () => import('../pages/AdminPage');

// Precarga en segundo plano el chat mientras el usuario completa el formulario
// de inicio de sesión o registro
export function preloadAppScreens() {
    const run = () => {
        loadChatPage().catch(() => { /* se reintentará al navegar */ });
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 800);
}
