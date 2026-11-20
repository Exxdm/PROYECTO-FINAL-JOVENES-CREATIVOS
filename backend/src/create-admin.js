import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Admin } from './models.js';
import { configureDns } from './configure-dns.js';


configureDns();

if (!process.env.MONGODB_URI) throw new Error('Configura MONGODB_URI en backend/.env.');
const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
if (!email || !password || password.length < 12) throw new Error('Uso: npm run create-admin -- correo contraseña-de-12-caracteres');
await mongoose.connect(process.env.MONGODB_URI);
const passwordHash = await bcrypt.hash(password, 12);
await Admin.findOneAndUpdate({ email }, { email, passwordHash }, { upsert: true, new: true, runValidators: true });
console.log(`Credenciales administrativas configuradas para ${email}.`);
await mongoose.disconnect();
