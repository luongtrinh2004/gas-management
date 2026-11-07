import mongoose from 'mongoose'

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gas'

let cached = globalThis.__mongoose
if (!cached) cached = globalThis.__mongoose = { conn: null, promise: null }

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    mongoose.set('strictQuery', true)
    cached.promise = mongoose.connect(URI, { serverSelectionTimeoutMS: 8000 }).then(m => m)
  }
  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }
  return cached.conn
}

export default mongoose
