'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { toMachineModelName } from '@/utils/suggestMatch'
import {
  calcContractEndDate,
  parseNumberCell,
  type ClientExcelRow,
  type MachineExcelRow,
} from '@/utils/clientInventoryExcel'

export type ClientImportResolution = 'keep' | 'overwrite'

async function requireOrg() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, error: '로그인이 필요합니다.' as string, orgId: null as string | null }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) {
    return { supabase, error: '조직 정보를 찾을 수 없습니다.', orgId: null }
  }
  return { supabase, error: null, orgId: profile.organization_id as string }
}

function normalizeStatus(raw: string): string {
  const s = (raw || '').trim().toLowerCase()
  if (!s || s === 'active' || s === '활성' || s === '사용') return 'active'
  if (s === 'inactive' || s === '비활성' || s === '중지') return 'inactive'
  return raw.trim() || 'active'
}

function normalizeContractType(raw: string): string | null {
  const s = (raw || '').trim()
  if (!s) return null
  if (s.includes('임대')) return '임대'
  if (s.includes('판매')) return '판매'
  if (s.includes('유지')) return '유지보수'
  return s
}

function clientPayloadFromExcel(row: ClientExcelRow, orgId: string) {
  return {
    name: row.회사명?.trim() || '',
    contact_person: row.담당자?.trim() || null,
    job_title: row.직책?.trim() || null,
    phone: row.담당자연락처?.trim() || null,
    office_phone: row.일반연락처?.trim() || null,
    address: row.주소?.trim() || null,
    business_number: row.사업자번호?.trim() || null,
    representative_name: row.대표자명?.trim() || null,
    email: row.이메일?.trim() || null,
    memo: row.메모?.trim() || null,
    status: normalizeStatus(row.상태),
    organization_id: orgId,
    is_deleted: false,
  }
}

export async function importClientsMachinesFromExcelAction(
  clients: ClientExcelRow[],
  machines: MachineExcelRow[],
  clientResolutions: Record<string, ClientImportResolution> = {}
) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) {
    return { success: false, message: authErr || '조직 정보 없음', errors: [] as string[] }
  }

  const errors: string[] = []
  let clientCreated = 0
  let clientSkipped = 0
  let clientUpdated = 0
  let machineCreated = 0
  let machineSkipped = 0

  try {
    const { data: existingClients } = await supabase
      .from('clients')
      .select('id, name, parent_id')
      .eq('organization_id', orgId)
      .eq('is_deleted', false)

    const clientIdByName = new Map<string, string>()
    for (const c of existingClients || []) {
      if (c.name) clientIdByName.set(c.name.trim().toLowerCase(), c.id)
    }

    const pendingParent: { name: string; parentName: string }[] = []

    for (let i = 0; i < clients.length; i++) {
      const row = clients[i]
      const name = row.회사명?.trim()
      if (!name) {
        errors.push(`거래처 ${i + 2}행: 회사명 없음`)
        continue
      }
      const key = name.toLowerCase()
      const existingId = clientIdByName.get(key)

      if (existingId) {
        const resolution = clientResolutions[key] || 'keep'
        if (resolution === 'keep') {
          clientSkipped += 1
          const parentName = row.소속본사?.trim()
          if (parentName) pendingParent.push({ name, parentName })
          continue
        }

        const payload = clientPayloadFromExcel(row, orgId)
        const { error } = await supabase
          .from('clients')
          .update({
            contact_person: payload.contact_person,
            job_title: payload.job_title,
            phone: payload.phone,
            office_phone: payload.office_phone,
            address: payload.address,
            business_number: payload.business_number,
            representative_name: payload.representative_name,
            email: payload.email,
            memo: payload.memo,
            status: payload.status,
          })
          .eq('id', existingId)
          .eq('organization_id', orgId)

        if (error) {
          const msg = error.message || '수정 실패'
          if (msg.includes('job_title') || msg.includes('schema cache')) {
            errors.push(
              `거래처 "${name}": DB에 job_title 컬럼이 없습니다. supabase/migrations/add_excel_contract_fields.sql 을 실행하세요.`
            )
          } else {
            errors.push(`거래처 "${name}" 덮어쓰기 실패: ${msg}`)
          }
          continue
        }

        clientUpdated += 1
        const parentName = row.소속본사?.trim()
        if (parentName) pendingParent.push({ name, parentName })
        continue
      }

      const payload = {
        ...clientPayloadFromExcel(row, orgId),
        parent_id: null,
      }

      const { data: created, error } = await supabase
        .from('clients')
        .insert(payload)
        .select('id')
        .single()

      if (error || !created) {
        const msg = error?.message || '등록 실패'
        if (msg.includes('job_title') || msg.includes('schema cache')) {
          errors.push(
            `거래처 "${name}": DB에 job_title 컬럼이 없습니다. supabase/migrations/add_excel_contract_fields.sql 을 실행하세요.`
          )
        } else {
          errors.push(`거래처 "${name}": ${msg}`)
        }
        continue
      }

      clientIdByName.set(key, created.id)
      clientCreated += 1

      const parentName = row.소속본사?.trim()
      if (parentName) {
        pendingParent.push({ name, parentName })
      }
    }

    for (const item of pendingParent) {
      const childId = clientIdByName.get(item.name.toLowerCase())
      const parentId = clientIdByName.get(item.parentName.toLowerCase())
      if (!childId) continue
      if (!parentId) {
        errors.push(`거래처 "${item.name}": 소속본사 "${item.parentName}"를 찾을 수 없음`)
        continue
      }
      if (childId === parentId) continue
      const { error } = await supabase
        .from('clients')
        .update({ parent_id: parentId })
        .eq('id', childId)
        .eq('organization_id', orgId)
      if (error) errors.push(`거래처 "${item.name}" 소속본사 연결 실패: ${error.message}`)
    }

    const { data: existingMachines } = await supabase
      .from('inventory')
      .select('id, serial_number')
      .eq('organization_id', orgId)

    const serialSet = new Set(
      (existingMachines || [])
        .map((m) => String(m.serial_number || '').trim().toLowerCase())
        .filter(Boolean)
    )

    for (let i = 0; i < machines.length; i++) {
      const row = machines[i]
      const serial = row.기계번호?.trim()
      const modelRaw = row.기종?.trim()
      const brand = row.브랜드?.trim() || '미입력'
      if (!serial || !modelRaw) {
        errors.push(`기기 ${i + 2}행: 기종/기계번호 필수`)
        continue
      }

      const modelName = toMachineModelName(modelRaw)
      if (!modelName) {
        errors.push(`기기 "${serial}": 기종(모델명)은 영어·숫자만 가능합니다.`)
        continue
      }

      const serialKey = serial.toLowerCase()
      if (serialSet.has(serialKey)) {
        machineSkipped += 1
        continue
      }

      const statusRaw = row.상태?.trim() || ''
      let clientId: string | null = null
      const clientName = row.거래처명?.trim()
      if (clientName) {
        clientId = clientIdByName.get(clientName.toLowerCase()) || null
        if (!clientId) {
          errors.push(`기기 "${serial}": 거래처 "${clientName}"를 찾을 수 없음`)
          continue
        }
      }

      let status = statusRaw || (clientId ? '설치' : '창고')
      if (clientId && status === '창고') status = '설치'
      if (!clientId && status === '설치') {
        errors.push(`기기 "${serial}": 상태가 설치이면 거래처명이 필요합니다.`)
        continue
      }

      const start = row.계약시작일?.trim() || null
      const yearsNum = parseNumberCell(row.계약년수)
      let end = row.계약종료일?.trim() || null
      if (start && yearsNum != null && yearsNum > 0) {
        end = calcContractEndDate(start, yearsNum) || end
      }

      const payload: Record<string, unknown> = {
        organization_id: orgId,
        type: row.종류?.trim() || 'A3 레이저복합기',
        category: row.구분?.trim() || '컬러',
        brand,
        model_name: modelName,
        serial_number: serial,
        status,
        client_id: clientId,
        department: row.부서?.trim() || null,
        product_condition: row.제품상태?.trim() || '새제품',
        purchase_price: parseNumberCell(row.매입가) ?? 0,
        billing_date: row.청구일?.trim() || (clientId ? '말일' : null),
        plan_basic_fee: parseNumberCell(row.기본요금),
        plan_basic_cnt_bw: parseNumberCell(row.흑백기본매수),
        plan_basic_cnt_col: parseNumberCell(row.칼라기본매수),
        plan_price_bw: parseNumberCell(row.흑백추가매수),
        plan_price_col: parseNumberCell(row.칼라추가매수),
        contract_type: normalizeContractType(row.계약구분),
        deposit: parseNumberCell(row.보증금),
        sale_price: parseNumberCell(row.판매금액),
        contract_start_date: start,
        contract_end_date: end,
        contract_years: yearsNum,
        memo: row.비고?.trim() || null,
        created_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('inventory').insert(payload)
      if (error) {
        const msg = error.message || '등록 실패'
        if (
          msg.includes('contract_type') ||
          msg.includes('deposit') ||
          msg.includes('sale_price') ||
          msg.includes('contract_years') ||
          msg.includes('schema cache')
        ) {
          errors.push(
            `기기 "${serial}": DB 컬럼이 없습니다. supabase/migrations/add_excel_contract_fields.sql 을 실행하세요. (${msg})`
          )
        } else {
          errors.push(`기기 "${serial}": ${msg}`)
        }
        continue
      }

      serialSet.add(serialKey)
      machineCreated += 1
    }

    revalidatePath('/clients')
    revalidatePath('/inventory')
    revalidatePath('/')

    const parts = [`거래처 신규 ${clientCreated}건`]
    if (clientUpdated) parts.push(`덮어쓰기 ${clientUpdated}건`)
    if (clientSkipped) parts.push(`기존 유지 ${clientSkipped}건`)
    parts.push(`기기 등록 ${machineCreated}건`)
    if (machineSkipped) parts.push(`시리얼 중복 스킵 ${machineSkipped}건`)

    return {
      success: true,
      message: parts.join(' · '),
      errors,
      clientCreated,
      clientUpdated,
      clientSkipped,
      machineCreated,
    }
  } catch (e: any) {
    return {
      success: false,
      message: '일괄 등록 실패: ' + (e?.message || '알 수 없는 오류'),
      errors,
    }
  }
}
