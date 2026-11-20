import 'dotenv/config';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Admin, Lead, SuccessStory } from './models.js';
import { configureDns } from './configure-dns.js';
import { answerChat } from './chatbot.js';
import { authenticate } from './auth.js';
import { AppError, asyncHandler, errorHandler, notFound } from './errors.js';


configureDns();

const app = express();
const port = Number(process.env.PORT || 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, '../../');
const uploads = path.join(frontend, 'uploads');
mkdirSync(uploads, { recursive: true });
const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Configura MONGODB_URI y un JWT_SECRET de al menos 32 caracteres.');
}

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new AppError(403, 'Origen no permitido.', 'CORS_DENIED'));
} }));
app.use(express.json({ limit: '32kb' }));
app.use('/uploads', express.static(uploads, { fallthrough: false, maxAge: '7d' }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { status: 429, code: 'RATE_LIMITED', message: 'Demasiados intentos. Espera 15 minutos e intenta otra vez.' } } });
const formLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { status: 429, code: 'RATE_LIMITED', message: 'Se alcanzó el límite de envíos. Intenta más tarde.' } } });

function cleanString(value, field, required = false, max = 1200) {
  if (typeof value !== 'string') {
    if (required) throw new AppError(400, `El campo ${field} es obligatorio.`, 'VALIDATION_ERROR');
    return '';
  }
  const clean = value.trim();
  if (required && !clean) throw new AppError(400, `El campo ${field} es obligatorio.`, 'VALIDATION_ERROR');
  if (clean.length > max) throw new AppError(400, `El campo ${field} supera el máximo permitido.`, 'VALIDATION_ERROR');
  return clean;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/stories', asyncHandler(async (req, res) => {
  const stories = await SuccessStory.find()
    .select('title person description result image')
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();
  res.json({ stories });
}));

app.post('/api/chat', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { status: 429, code: 'RATE_LIMITED', message: 'Has enviado muchas preguntas. Espera un momento e intenta de nuevo.' } }
}), asyncHandler(async (req, res) => {
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 12) {
    throw new AppError(400, 'La conversación no es válida. Inicia un chat nuevo.', 'INVALID_CHAT');
  }

  let previousRole = 'assistant';
  const cleanMessages = messages.map(message => {
    if (!message || !['user', 'assistant'].includes(message.role) || message.role === previousRole) {
      throw new AppError(400, 'La conversación no es válida. Inicia un chat nuevo.', 'INVALID_CHAT');
    }
    previousRole = message.role;
    if (typeof message.content !== 'string') {
      throw new AppError(400, 'Escribe una pregunta para continuar.', 'INVALID_CHAT');
    }
    const content = message.content.trim();
    if (!content || content.length > 1200) {
      throw new AppError(400, 'Cada mensaje debe tener entre 1 y 1200 caracteres.', 'INVALID_CHAT');
    }
    return { role: message.role, content };
  });

  if (cleanMessages.at(-1).role !== 'user') {
    throw new AppError(400, 'Envía una pregunta para continuar.', 'INVALID_CHAT');
  }

  const answer = await answerChat(cleanMessages);
  res.json({ answer });
}));

app.post('/api/contact', formLimiter, asyncHandler(async (req, res) => {
  const data = {
    type: 'contact',
    nombre: cleanString(req.body.nombre, 'nombre', true, 100),
    email: cleanString(req.body.email, 'email', true, 254).toLowerCase(),
    telefono: cleanString(req.body.telefono, 'teléfono', false, 30),
    interes: cleanString(req.body.interes, 'interés', true, 80),
    mensaje: cleanString(req.body.mensaje, 'mensaje', true, 2000)
  };
  if (!validEmail(data.email)) throw new AppError(400, 'Escribe un correo válido.', 'INVALID_EMAIL');
  await Lead.create(data);
  res.status(201).json({ message: 'Formulario recibido correctamente.' });
}));

app.post('/api/partners', formLimiter, asyncHandler(async (req, res) => {
  const data = {
    type: 'partner',
    gimnasio: cleanString(req.body.gimnasio, 'gimnasio', true, 120),
    ciudad: cleanString(req.body.ciudad, 'ciudad', true, 100),
    nombre: cleanString(req.body.nombre, 'nombre', true, 100),
    email: cleanString(req.body.email, 'email', true, 254).toLowerCase(),
    telefono: cleanString(req.body.telefono, 'teléfono', true, 30),
    mensaje: cleanString(req.body.mensaje, 'mensaje', false, 2000)
  };
  if (!validEmail(data.email)) throw new AppError(400, 'Escribe un correo válido.', 'INVALID_EMAIL');
  await Lead.create(data);
  res.status(201).json({ message: 'Solicitud de alianza recibida correctamente.' });
}));

app.post('/api/admin/login', loginLimiter, asyncHandler(async (req, res) => {
  const email = cleanString(req.body.email, 'correo', true, 254).toLowerCase();
  const password = cleanString(req.body.password, 'contraseña', true, 200);
  const admin = await Admin.findOne({ email });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    throw new AppError(401, 'El correo o la contraseña no son correctos.', 'INVALID_CREDENTIALS');
  }
  const token = jwt.sign({ sub: admin.id }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  res.json({ token, admin: { email: admin.email } });
}));

app.use('/api/admin', authenticate);

app.get('/api/admin/overview', asyncHandler(async (req, res) => {
  const [contacts, partners, stories, recentLeads] = await Promise.all([
    Lead.countDocuments({ type: 'contact' }),
    Lead.countDocuments({ type: 'partner' }),
    SuccessStory.countDocuments(),
    Lead.find().sort({ createdAt: -1 }).limit(5).lean()
  ]);
  res.json({ contacts, partners, stories, recentLeads });
}));

app.get('/api/admin/leads', asyncHandler(async (req, res) => {
  const type = req.query.type;
  if (type && !['contact', 'partner'].includes(type)) throw new AppError(400, 'Filtro de formulario no válido.', 'VALIDATION_ERROR');
  const filter = type ? { type } : {};
  const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(300).lean();
  res.json({ leads });
}));

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploads),
  filename: (req, file, callback) => {
    const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter(req, file, callback) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new AppError(400, 'La imagen debe ser JPG, PNG o WebP.', 'INVALID_FILE_TYPE'));
  callback(null, true);
} });

app.get('/api/admin/stories', asyncHandler(async (req, res) => {
  const stories = await SuccessStory.find().sort({ createdAt: -1 }).lean();
  res.json({ stories });
}));

app.post('/api/admin/stories', upload.single('image'), asyncHandler(async (req, res) => {
  const data = {
    title: cleanString(req.body.title, 'título', true, 100),
    person: cleanString(req.body.person, 'persona', true, 80),
    description: cleanString(req.body.description, 'historia', true, 1200),
    result: cleanString(req.body.result, 'resultado', false, 120),
    image: req.file ? `/uploads/${req.file.filename}` : ''
  };
  const story = await SuccessStory.create(data);
  res.status(201).json({ story });
}));

app.put('/api/admin/stories/:id', upload.single('image'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, 'Identificador no válido.', 'VALIDATION_ERROR');
  const data = {
    title: cleanString(req.body.title, 'título', true, 100),
    person: cleanString(req.body.person, 'persona', true, 80),
    description: cleanString(req.body.description, 'historia', true, 1200),
    result: cleanString(req.body.result, 'resultado', false, 120)
  };
  if (req.file) data.image = `/uploads/${req.file.filename}`;
  const story = await SuccessStory.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!story) throw new AppError(404, 'No se encontró ese caso de éxito.', 'NOT_FOUND');
  res.json({ story });
}));

app.delete('/api/admin/stories/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, 'Identificador no válido.', 'VALIDATION_ERROR');
  const story = await SuccessStory.findByIdAndDelete(req.params.id);
  if (!story) throw new AppError(404, 'No se encontró ese caso de éxito.', 'NOT_FOUND');
  res.json({ message: 'Caso de éxito eliminado.' });
}));

app.use('/api', notFound);
app.use('/backend', (req, res, next) => next(new AppError(404, 'La ruta solicitada no existe.', 'NOT_FOUND')));
app.use(express.static(frontend, { extensions: ['html'] }));
app.use(notFound);
app.use(errorHandler);

async function start() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const exists = await Admin.exists({ email });
    if (!exists) {
      if (process.env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await Admin.create({ email, passwordHash });
      console.log(`Administrador inicial creado: ${email}`);
    }
  }
  app.listen(port, () => console.log(`Vitalia está disponible en http://localhost:${port}`));
}

start().catch(error => {
  console.error('No fue posible iniciar Vitalia:', error.message);
  process.exit(1);
});
