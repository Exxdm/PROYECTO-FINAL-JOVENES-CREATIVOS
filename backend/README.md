# Backend de Vitalia

## Requisitos

- Node.js 20 o superior
- MongoDB local o una instancia administrada

## API

- `POST /api/contact` y `POST /api/partners` guardan formularios.
- `POST /api/admin/login` inicia sesión y devuelve un token firmado.
- `GET /api/admin/overview` y `GET /api/admin/leads` consultan estadísticas y formularios.
- `GET`, `POST`, `PUT` y `DELETE /api/admin/stories` administran casos de éxito e imágenes.
- `GET /api/health` informa el estado del servidor.

## Chat con IA

El widget web consulta el endpoint POST /api/chat del backend. Para habilitarlo, agrega tu clave de Gemini al archivo backend/.env:

GEMINI_API_KEY=tu_clave_de_api
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite