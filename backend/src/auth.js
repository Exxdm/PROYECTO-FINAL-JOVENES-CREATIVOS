import jwt from 'jsonwebtoken';
import { AppError, asyncHandler } from './errors.js';
import { Admin } from './models.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Inicia sesión para continuar.', 'AUTH_REQUIRED');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new AppError(401, 'La sesión venció. Inicia sesión nuevamente.', 'INVALID_TOKEN');
  }
  const admin = await Admin.findById(payload.sub).select('_id email');
  if (!admin) throw new AppError(401, 'La sesión ya no es válida.', 'INVALID_SESSION');
  req.admin = admin;
  next();
});
