/* Same-origin API client: the backend serves both the site and /api. */
window.api = {
  async post(key, data) {
    const config = window.VITALIA;
    if (config.MOCK) return { ok: true };

    const endpoint = config.ENDPOINTS[key];
    if (!endpoint) throw new Error('Este servicio no está disponible.');

    const controller = new AbortController();
    const timeoutMs = key === 'chat' ? 70000 : config.TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${config.API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error?.message || 'No fue posible enviar el formulario.');
      }
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('La solicitud tardó demasiado. Intenta de nuevo.');
      }
      if (error instanceof TypeError) {
        throw new Error('No hay conexión con el servidor. Intenta de nuevo más tarde.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
};
