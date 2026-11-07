import '@/server/api'
import { dispatch } from '@/server/core'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const handler = async (req, { params }) => dispatch(req, (await params).path || [])

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
