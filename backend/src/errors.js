export class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function notFound(req, res, next) {
  next(new AppError(404, 'La ruta solicitada no existe.', 'NOT_FOUND'));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message;
  let code = error.code || 'INTERNAL_ERROR';
  if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'El cuerpo de la solicitud no contiene JSON válido.';
    code = 'INVALID_JSON';
  }
  if (error.type === 'entity.too.large') {
    status = 413;
    message = 'El cuerpo de la solicitud supera el tamaño permitido.';
    code = 'PAYLOAD_TOO_LARGE';
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    status = 400;
    message = 'Los datos enviados no son válidos.';
    code = 'VALIDATION_ERROR';
  }
  if (error.code === 11000) {
    status = 409;
    message = 'Ya existe un registro con esos datos.';
    code = 'DUPLICATE_ENTRY';
  }
  if (error.name === 'MulterError') {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = status === 413 ? 'La imagen supera el tamaño máximo de 5 MB.' : 'No fue posible procesar la imagen.';
    code = 'UPLOAD_ERROR';
  }
  if (status >= 500) {
    console.error(error);
    if (!(error instanceof AppError) || status === 500) {
      status = 500;
      message = 'Ocurrió un error interno. Intenta de nuevo más tarde.';
      code = 'INTERNAL_ERROR';
    }
  }
  res.status(status).json({ error: { status, code, message } });
}
