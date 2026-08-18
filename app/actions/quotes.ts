'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { todayYmd } from '@/utils/koreanAmount'
import { calcQuoteTotals } from '@/utils/quoteTotals'
import { DEFAULT_ISSUER } from '@/utils/quoteDefaults'

export type QuoteItemInput = {
  id?: string
  description: string
  unit: string
  quantity: number
  unit_price: number
  /** 공급가액 칸에 표시할 텍스트(임대 정보). 있으면 숫자 대신 표시 */
  amount_text?: string | null
  exclude_from_total?: boolean
  sort_order?: number
}

export type QuoteInput = {
  id?: string
  quote_no?: string | null
  quote_date: string
  client_id?: string | null
  client_name: string
  title?: string
  intro?: string
  notes?: string | null
  /** 비고 아래 문의/안내 문구 */
  footer_notice?: string | null
  issuer_company?: string | null
  issuer_partner?: string | null
  issuer_ceo?: string | null
  issuer_biz_no?: string | null
  issuer_address?: string | null
  issuer_manager?: string | null
  issuer_tel?: string | null
  issuer_hp?: string | null
  issuer_homepage?: string | null
  issuer_blog?: string | null
  vat_rate?: number
  status?: string
  items: QuoteItemInput[]
}

async function requireOrg() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, error: '로그인이 필요합니다.' as string, orgId: null as string | null, userId: null as string | null }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) {
    return { supabase, error: '조직 정보를 찾을 수 없습니다.', orgId: null, userId: user.id }
  }
  return { supabase, error: null, orgId: profile.organization_id as string, userId: user.id }
}

function schemaHint(msg: string) {
  if (/quotes|quote_items|footer_notice|amount_text|unit_price_text|schema cache/i.test(msg)) {
    return 'DB에 견적서 컬럼/테이블이 없습니다. supabase/migrations 의 add_quotes.sql, alter_quotes_footer_amount_text.sql, alter_quotes_unit_price_text.sql 을 실행하세요.'
  }
  return msg
}

export async function listQuotesAction() {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, message: authErr || '권한 없음', data: [] as any[] }

  const { data, error } = await supabase
    .from('quotes')
    .select('id, quote_no, quote_date, client_name, status, notes, created_at, updated_at')
    .eq('organization_id', orgId)
    .order('quote_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false as const, message: schemaHint(error.message), data: [] as any[] }
  }

  const ids = (data || []).map((q) => q.id)
  let totalsById = new Map<string, { supply: number; vat: number; total: number }>()
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from('quote_items')
      .select('quote_id, quantity, unit_price, exclude_from_total')
      .in('quote_id', ids)
      .eq('organization_id', orgId)

    const grouped = new Map<string, any[]>()
    for (const row of items || []) {
      const list = grouped.get(row.quote_id) || []
      list.push(row)
      grouped.set(row.quote_id, list)
    }
    for (const [qid, list] of grouped) {
      totalsById.set(qid, calcQuoteTotals(list))
    }
  }

  return {
    success: true as const,
    message: 'ok',
    data: (data || []).map((q) => ({
      ...q,
      totals: totalsById.get(q.id) || { supply: 0, vat: 0, total: 0 },
    })),
  }
}

export async function getQuoteAction(id: string) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, message: authErr || '권한 없음', data: null }

  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (error || !quote) {
    return { success: false as const, message: schemaHint(error?.message || '견적서를 찾을 수 없습니다.'), data: null }
  }

  const { data: items, error: itemErr } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', id)
    .eq('organization_id', orgId)
    .order('sort_order', { ascending: true })

  if (itemErr) {
    return { success: false as const, message: itemErr.message, data: null }
  }

  return {
    success: true as const,
    message: 'ok',
    data: {
      ...quote,
      items: items || [],
      totals: calcQuoteTotals(items || [], Number(quote.vat_rate) || 10),
    },
  }
}

export async function saveQuoteAction(input: QuoteInput) {
  const { supabase, error: authErr, orgId, userId } = await requireOrg()
  if (authErr || !orgId || !userId) {
    return { success: false as const, message: authErr || '권한 없음', id: null as string | null }
  }

  if (!String(input.client_name || '').trim()) {
    return { success: false as const, message: '수신 거래처명(貴中)을 입력하세요.', id: null }
  }

  const items = (input.items || []).filter((i) => String(i.description || '').trim())
  if (items.length === 0) {
    return { success: false as const, message: '품목을 1개 이상 입력하세요.', id: null }
  }

  const header = {
    organization_id: orgId,
    created_by: userId,
    quote_no: input.quote_no?.trim() || null,
    quote_date: input.quote_date || todayYmd(),
    client_id: input.client_id || null,
    client_name: input.client_name.trim(),
    title: input.title || '見積書',
    intro: input.intro || '아래와 같이 見積합니다.',
    notes: input.notes?.trim() || null,
    footer_notice: input.footer_notice?.trim() || null,
    issuer_company: input.issuer_company ?? DEFAULT_ISSUER.issuer_company,
    issuer_partner: input.issuer_partner ?? DEFAULT_ISSUER.issuer_partner,
    issuer_ceo: input.issuer_ceo ?? DEFAULT_ISSUER.issuer_ceo,
    issuer_biz_no: input.issuer_biz_no ?? DEFAULT_ISSUER.issuer_biz_no,
    issuer_address: input.issuer_address ?? DEFAULT_ISSUER.issuer_address,
    issuer_manager: input.issuer_manager ?? DEFAULT_ISSUER.issuer_manager,
    issuer_tel: input.issuer_tel ?? DEFAULT_ISSUER.issuer_tel,
    issuer_hp: input.issuer_hp ?? DEFAULT_ISSUER.issuer_hp,
    issuer_homepage: input.issuer_homepage ?? DEFAULT_ISSUER.issuer_homepage,
    issuer_blog: input.issuer_blog ?? DEFAULT_ISSUER.issuer_blog,
    vat_rate: input.vat_rate ?? 10,
    status: input.status || 'draft',
    updated_at: new Date().toISOString(),
  }

  try {
    let quoteId = input.id || null

    if (quoteId) {
      const { error } = await supabase
        .from('quotes')
        .update(header)
        .eq('id', quoteId)
        .eq('organization_id', orgId)
      if (error) throw error

      await supabase.from('quote_items').delete().eq('quote_id', quoteId).eq('organization_id', orgId)
    } else {
      const { data: created, error } = await supabase
        .from('quotes')
        .insert(header)
        .select('id')
        .single()
      if (error || !created) throw new Error(error?.message || '등록 실패')
      quoteId = created.id
    }

    const rows = items.map((i, idx) => ({
      quote_id: quoteId!,
      organization_id: orgId,
      sort_order: i.sort_order ?? idx,
      description: String(i.description).trim(),
      unit: i.unit || '대',
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
      amount_text: i.amount_text?.trim() || null,
      exclude_from_total: Boolean(i.exclude_from_total),
    }))

    const { error: itemErr } = await supabase.from('quote_items').insert(rows)
    if (itemErr) throw itemErr

    revalidatePath('/quotes')
    return { success: true as const, message: '견적서가 저장되었습니다.', id: quoteId }
  } catch (e: any) {
    return { success: false as const, message: schemaHint(e?.message || '저장 실패'), id: null }
  }
}

export async function deleteQuoteAction(id: string) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, message: authErr || '권한 없음' }

  const { error } = await supabase.from('quotes').delete().eq('id', id).eq('organization_id', orgId)
  if (error) return { success: false as const, message: schemaHint(error.message) }

  revalidatePath('/quotes')
  return { success: true as const, message: '삭제되었습니다.' }
}

export async function listClientsForQuoteAction() {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, data: [] as { id: string; name: string }[] }

  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('is_deleted', false)
    .order('name')

  return { success: true as const, data: (data || []) as { id: string; name: string }[] }
}
