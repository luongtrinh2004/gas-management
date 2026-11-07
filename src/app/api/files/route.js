// Upload / xem ảnh chứng từ (hóa đơn giấy). Lưu đĩa tại .uploads/ (đặt UPLOAD_DIR để đổi).
import { mkdir, writeFile, readFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { getSession } from '@/server/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), '.uploads')
const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }
const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' }
const MAX = 10 * 1024 * 1024

export async function POST(req) {
  const s = await getSession()
  if (!s) return Response.json({ error: 'Phiên đăng nhập hết hạn' }, { status: 401 })
  const form = await req.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string') return Response.json({ error: 'Thiếu tệp' }, { status: 400 })
  const ext = TYPES[file.type]
  if (!ext) return Response.json({ error: 'Chỉ nhận ảnh JPG/PNG/WEBP hoặc PDF' }, { status: 400 })
  if (file.size > MAX) return Response.json({ error: 'Tệp quá lớn (tối đa 10MB)' }, { status: 400 })
  await mkdir(DIR, { recursive: true })
  const name = crypto.randomUUID() + ext
  await writeFile(path.join(DIR, name), Buffer.from(await file.arrayBuffer()))
  return Response.json({ data: { name: file.name, url: `/api/files?f=${name}`, uploadedBy: s.name, uploadedAt: new Date().toISOString() } })
}

export async function GET(req) {
  const s = await getSession()
  if (!s) return Response.json({ error: 'Phiên đăng nhập hết hạn' }, { status: 401 })
  const f = path.basename(new URL(req.url).searchParams.get('f') || '')
  const ext = path.extname(f)
  if (!MIME[ext]) return Response.json({ error: 'Không hợp lệ' }, { status: 400 })
  try {
    const buf = await readFile(path.join(DIR, f))
    return new Response(buf, { headers: { 'Content-Type': MIME[ext], 'Cache-Control': 'private, max-age=3600' } })
  } catch {
    return Response.json({ error: 'Không tìm thấy tệp' }, { status: 404 })
  }
}
