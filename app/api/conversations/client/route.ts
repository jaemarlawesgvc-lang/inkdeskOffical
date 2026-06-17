import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: conv } = await supabase
    .from('conversations')
    .select(`
      id,
      client_name,
      artist_id,
      artists (
        display_name,
        username
      )
    `)
    .eq('client_token', token)
    .single()

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conv.id)
    .eq('sender_type', 'artist')
    .is('read_at', null)

  const { data: messages } = await supabase
    .from('messages')
    .select('id, body, sender_type, read_at, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })

  const artist = conv.artists as unknown as { display_name: string | null; username: string } | null

  return NextResponse.json({
    conversationId: conv.id,
    clientName: conv.client_name,
    artistName: artist?.display_name ?? artist?.username ?? 'Artist',
    messages: messages ?? [],
  })
}

const sendSchema = z.object({
  token: z.string().uuid(),
  body: z.string().min(1).max(5000).trim(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Validation failed' }, { status: 422 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('client_token', parsed.data.token)
    .single()

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conv.id,
      sender_type: 'client',
      body: parsed.data.body,
    })
    .select('id, body, sender_type, created_at')
    .single()

  if (msgError) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conv.id)

  return NextResponse.json({ message: msg })
}
