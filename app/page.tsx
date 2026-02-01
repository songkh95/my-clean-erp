'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Inventory, Settlement } from '@/app/types'

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [orgName, setOrgName] = useState('')
  
  // 대시보드 통계 데이터 상태
  const [metrics, setMetrics] = useState({
    clientCount: 0,
    inventoryTotal: 0,
    inventoryInstalled: 0,
    inventoryWarehouse: 0,
    currentMonthAmount: 0,
    unpaidCount: 0
  })

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        // 1. 프로필 및 조직 정보 가져오기
        const { data: profile } = await supabase
          .from('profiles')
          .select(`name, organizations ( id, name )`)
          .eq('id', user.id)
          .single()

        if (profile) {
          setUserName(profile.name || '사용자')
          
          // 조직 정보 타입 안전하게 처리
          // Supabase 관계 쿼리 결과는 배열일 수도 있고 단일 객체일 수도 있음
          const orgData = profile.organizations
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const org = Array.isArray(orgData) ? orgData[0] : (orgData as any)

          setOrgName(org?.name || '소속 없음')
          const orgId = org?.id

          if (orgId) {
            // 2. 병렬로 데이터 통계 가져오기
            const [clientsRes, inventoryRes, settlementRes, unpaidRes] = await Promise.all([
              // 거래처 수
              supabase.from('clients').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_deleted', false),
              
              // 자산 현황 (전체 목록을 가져와서 상태별로 분류)
              supabase.from('inventory').select('status').eq('organization_id', orgId),

              // 이번 달 청구 금액 합계 (현재 연/월 기준)
              supabase.from('settlements')
                .select('total_amount')
                .eq('organization_id', orgId)
                .eq('billing_year', new Date().getFullYear())
                .eq('billing_month', new Date().getMonth() + 1),

              // 미수금 건수 (is_paid가 false인 정산서)
              supabase.from('settlements')
                .select('id', { count: 'exact', head: true })
                .eq('organization_id', orgId)
                .eq('is_paid', false)
            ])

            // 3. 통계 계산
            // Inventory 타입을 사용하여 필터링
            const invData = (inventoryRes.data as unknown as Pick<Inventory, 'status'>[]) || []
            const installedCount = invData.filter(i => i.status === '설치').length
            const warehouseCount = invData.filter(i => i.status === '창고').length
            
            // Settlement 타입을 사용하여 합계 계산
            const settlementData = (settlementRes.data as unknown as Pick<Settlement, 'total_amount'>[]) || []
            const totalAmount = settlementData.reduce((sum, row) => sum + (row.total_amount || 0), 0)

            setMetrics({
              clientCount: clientsRes.count || 0,
              inventoryTotal: invData.length,
              inventoryInstalled: installedCount,
              inventoryWarehouse: warehouseCount,
              currentMonthAmount: totalAmount,
              unpaidCount: unpaidRes.count || 0
            })
          }
        }
      } catch (error) {
        console.error('데이터 로딩 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, supabase])

  if (loading) return <div style={{ padding: '40px', color: 'var(--notion-sub-text)' }}>데이터를 불러오는 중...</div>

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* 1. 상단 환영 섹션 */}
      <section style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '10px', color: 'var(--notion-main-text)' }}>
          👋 안녕하세요, {userName}님!
        </h1>
        <p style={{ color: 'var(--notion-sub-text)', fontSize: '1rem' }}>
          <strong style={{ color: 'var(--notion-blue)' }}>{orgName}</strong>의 현황을 한눈에 확인하세요.
        </p>
      </section>

      {/* 2. 핵심 지표 카드 (Grid Layout) */}
      <section style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '24px',
        marginBottom: '40px'
      }}>
        {/* 거래처 카드 */}
        <div style={cardStyle}>
          <div style={cardIconStyle}>🏢</div>
          <div>
            <div style={cardLabelStyle}>관리 중인 거래처</div>
            <div style={cardValueStyle}>{metrics.clientCount} <span style={unitStyle}>곳</span></div>
          </div>
        </div>

        {/* 자산 카드 */}
        <div style={cardStyle}>
          <div style={cardIconStyle}>TB</div>
          <div style={{ width: '100%' }}>
            <div style={{...cardLabelStyle, marginBottom: '8px'}}>자산(기기) 현황</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--notion-sub-text)' }}>설치됨</span>
              <span style={{ fontWeight: '600', color: 'var(--notion-blue)' }}>{metrics.inventoryInstalled}대</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--notion-sub-text)' }}>창고 대기</span>
              <span style={{ fontWeight: '600', color: '#e67e22' }}>{metrics.inventoryWarehouse}대</span>
            </div>
          </div>
        </div>

        {/* 이번 달 매출 카드 */}
        <div style={cardStyle}>
          <div style={cardIconStyle}>💰</div>
          <div>
            <div style={cardLabelStyle}>{new Date().getMonth() + 1}월 청구 확정액</div>
            <div style={{...cardValueStyle, color: 'var(--notion-blue)'}}>
              {metrics.currentMonthAmount.toLocaleString()} <span style={unitStyle}>원</span>
            </div>
            {metrics.unpaidCount > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#d93025', marginTop: '4px', fontWeight: '500' }}>
                ⚠️ 미수금 건수: {metrics.unpaidCount}건
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. 바로가기 메뉴 */}
      <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '20px', color: 'var(--notion-main-text)' }}>🚀 바로가기</h3>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <Link href="/clients" style={shortcutStyle}>
          <span style={{ fontSize: '1.5rem', marginBottom: '10px', display: 'block' }}>👥</span>
          <span style={{ fontWeight: '600' }}>거래처 관리</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--notion-sub-text)', marginTop: '4px', display: 'block' }}>거래처 등록 및 수정</span>
        </Link>

        <Link href="/inventory" style={shortcutStyle}>
          <span style={{ fontSize: '1.5rem', marginBottom: '10px', display: 'block' }}>📦</span>
          <span style={{ fontWeight: '600' }}>자산 및 재고</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--notion-sub-text)', marginTop: '4px', display: 'block' }}>기기 입고 및 상태 변경</span>
        </Link>

        <Link href="/accounting" style={shortcutStyle}>
          <span style={{ fontSize: '1.5rem', marginBottom: '10px', display: 'block' }}>🧮</span>
          <span style={{ fontWeight: '600' }}>정산 및 회계</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--notion-sub-text)', marginTop: '4px', display: 'block' }}>월별 카운터 입력 및 청구</span>
        </Link>
      </section>

    </div>
  )
}

// 스타일 객체 (CSS Module 대체)
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--notion-bg)',
  border: '1px solid var(--notion-border)',
  borderRadius: '8px',
  padding: '24px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '16px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  transition: 'transform 0.2s',
}

const cardIconStyle: React.CSSProperties = {
  fontSize: '2rem',
  backgroundColor: 'var(--notion-soft-bg)',
  padding: '12px',
  borderRadius: '12px',
  lineHeight: '1',
}

const cardLabelStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--notion-sub-text)',
  marginBottom: '8px',
  fontWeight: '500',
}

const cardValueStyle: React.CSSProperties = {
  fontSize: '1.8rem',
  fontWeight: '700',
  color: 'var(--notion-main-text)',
}

const unitStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: '500',
  color: 'var(--notion-sub-text)',
}

const shortcutStyle: React.CSSProperties = {
  display: 'block',
  textDecoration: 'none',
  backgroundColor: 'var(--notion-bg)',
  border: '1px solid var(--notion-border)',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center',
  color: 'var(--notion-main-text)',
  transition: 'background-color 0.2s, border-color 0.2s',
}