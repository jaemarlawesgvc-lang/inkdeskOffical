import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(5000).trim(),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const conversationId = request.nextUrl.searchParams.get('conversation_id')
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('artist_id', artist.id)
    .single()

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('sender_type', 'client')
    .is('read_at', null)

  const { data: messages } = await supabase
    .from('messages')
    .select('id, body, sender_type, read_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages ?? [] })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

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

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', parsed.data.conversationId)
    .eq('artist_id', artist.id)
    .single()

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: parsed.data.conversationId,
      sender_type: 'artist',
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
    .eq('id', parsed.data.conversationId)

  return NextResponse.json({ message: msg })
}
