import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const adminSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const leadSchema = new Schema({
  type: { type: String, enum: ['contact', 'partner'], required: true, index: true },
  nombre: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  telefono: { type: String, trim: true, maxlength: 30 },
  interes: { type: String, trim: true, maxlength: 80 },
  gimnasio: { type: String, trim: true, maxlength: 120 },
  ciudad: { type: String, trim: true, maxlength: 100 },
  mensaje: { type: String, trim: true, maxlength: 2000 }
}, { timestamps: true, versionKey: false });

const successStorySchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  person: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 1200 },
  result: { type: String, trim: true, maxlength: 120 },
  image: { type: String, default: '' }
}, { timestamps: true, versionKey: false });

export const Admin = model('Admin', adminSchema);
export const Lead = model('Lead', leadSchema);
export const SuccessStory = model('SuccessStory', successStorySchema);
