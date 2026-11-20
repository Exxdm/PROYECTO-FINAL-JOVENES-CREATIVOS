/* Ajustes generales del sitio: API, modo de prueba y enlaces de navegación. */
// El sitio se sirve desde el backend y consume su API en el mismo origen.
window.VITALIA = {
    API_URL: '/api',
    MOCK: false,
    TIMEOUT_MS: 10000,
    ENDPOINTS: { contact: '/contact', partner: '/partners', chat: '/chat' },
    NAV: [
        ['index.html', 'Inicio'],
        ['nosotros.html', 'Sobre nosotros'],
        ['contacto.html', 'Contacto'],
        ['index.html#casos-de-exito', 'Historias'],
        ['aliados.html', 'Soy dueño de gym']
    ]
};
