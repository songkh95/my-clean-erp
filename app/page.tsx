'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loadAppSettings } from '@/utils/appSettings'

// 통계 데이터 타입 정의
interface DashboardMetrics {
  clientCount: number
  inventoryTotal: number
  inventoryInstalled: number
  inventoryWarehouse: number
  currentMonthAmount: number
  unpaidCount: number
}

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [dashboardNote, setDashboardNote] = useState('')
  
  // 초기 통계 상태
  const [metrics, setMetrics] = useState<DashboardMetrics>({
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
    setDashboardNote(loadAppSettings().general.dashboardNote)
    const onChange = () => setDashboardNote(loadAppSettings().general.dashboardNote)
    window.addEventListener('app-settings-changed', onChange)
    return () => window.removeEventListener('app-settings-changed', onChange)
  }, [])

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
          
          // 조직 정보 타입 처리
          const orgData = profile.organizations as any
          const org = Array.isArray(orgData) ? orgData[0] : orgData
          
          setOrgName(org?.name || '소속 없음')
          const orgId = org?.id

          if (orgId) {
            // 2. 핵심 지표 병렬 조회
            const now = new Date()
            const currentYear = now.getFullYear()
            const currentMonth = now.getMonth() + 1

            const [clientsRes, inventoryRes, settlementRes, unpaidRes] = await Promise.all([
              // 거래처 수 (삭제되지 않은 것)
              supabase.from('clients').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_deleted', false),
              
              // 자산 현황 (전체 목록)
              supabase.from('inventory').select('status').eq('organization_id', orgId),

              // 이번 달 청구 금액 합계
              supabase.from('settlements')
                .select('total_amount')
                .eq('organization_id', orgId)
                .eq('billing_year', currentYear)
                .eq('billing_month', currentMonth),

              // 미수금 건수 (전체 기간 중 미납된 건)
              supabase.from('settlements')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', orgId)
                .eq('is_paid', false)
            ])

            // 3. 통계 계산
            const invData = inventoryRes.data || []
            const installedCount = invData.filter((i: any) => i.status === '설치').length
            const warehouseCount = invData.filter((i: any) => i.status === '창고').length
            
            const settlementData = settlementRes.data || []
            const totalAmount = settlementData.reduce((sum: number, row: any) => sum + (row.total_amount || 0), 0)

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

  if (loading) return <div className="pageShell" style={{ color: '#666' }}>데이터를 불러오는 중...</div>

  return (
    <div className="pageShell">
      
      {/* 1. 상단 환영 섹션 */}
      <section style={{ marginBottom: '24px' }}>
        <h1 className="pageTitle" style={{ fontSize: '1.5rem' }}>
          안녕하세요, {userName}님!
        </h1>
        <p style={{ color: '#666', fontSize: '0.95rem', margin: 0 }}>
          <strong style={{ color: '#0070f3' }}>{orgName}</strong>의 현황을 한눈에 확인하세요.
        </p>
        {dashboardNote ? (
          <p style={{
            marginTop: 12,
            padding: '10px 12px',
            background: 'var(--notion-soft-bg)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.88rem',
            color: 'var(--notion-main-text)',
            whiteSpace: 'pre-wrap',
          }}>
            {dashboardNote}
          </p>
        ) : null}
      </section>

      {/* 2. 핵심 지표 카드 (Grid Layout) */}
      <section style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
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
          <div style={cardIconStyle}>🖨️</div>
          <div style={{ width: '100%' }}>
            <div style={{...cardLabelStyle, marginBottom: '8px'}}>자산(기기) 현황</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>설치됨</span>
              <span style={{ fontWeight: '600', color: '#0070f3' }}>{metrics.inventoryInstalled}대</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>창고 대기</span>
              <span style={{ fontWeight: '600', color: '#e67e22' }}>{metrics.inventoryWarehouse}대</span>
            </div>
          </div>
        </div>

        {/* 이번 달 매출 카드 */}
        <div style={cardStyle}>
          <div style={cardIconStyle}>💰</div>
          <div>
            <div style={cardLabelStyle}>{new Date().getMonth() + 1}월 청구 확정액</div>
            <div style={{...cardValueStyle, color: '#0070f3'}}>
              {metrics.currentMonthAmount.toLocaleString()} <span style={unitStyle}>원</span>
            </div>
            {metrics.unpaidCount > 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#d93025', marginTop: '6px', fontWeight: '500' }}>
                ⚠️ 미수금 건수: {metrics.unpaidCount}건
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#217346', marginTop: '6px', fontWeight: '500' }}>
                ✨ 모든 청구가 완료되었습니다.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. 바로가기 메뉴 */}
      <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '20px', color: '#171717' }}>🚀 바로가기</h3>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <Link href="/clients" style={shortcutStyle}>
          <span style={{ fontSize: '1.5rem', marginBottom: '10px', display: 'block' }}>👥</span>
          <span style={{ fontWeight: '600', display: 'block', marginBottom: '4px' }}>거래처 관리</span>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>거래처 등록 및 수정</span>
        </Link>

        <Link href="/inventory" style={shortcutStyle}>
          <span style={{ fontSize: '1.5rem', marginBottom: '10px', display: 'block' }}>📦</span>
          <span style={{ fontWeight: '600', display: 'block', marginBottom: '4px' }}>자산 및 재고</span>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>기기 입고 및 상태 변경</span>
        </Link>

        <Link href="/accounting" style={shortcutStyle}>
          <span style={{ fontSize: '1.5rem', marginBottom: '10px', display: 'block' }}>🧮</span>
          <span style={{ fontWeight: '600', display: 'block', marginBottom: '4px' }}>정산 및 회계</span>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>월별 카운터 입력 및 청구</span>
        </Link>
      </section>

    </div>
  )
}

// 스타일 객체
const cardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E5E5',
  borderRadius: '8px',
  padding: '16px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
}

const cardIconStyle: React.CSSProperties = {
  fontSize: '2rem',
  backgroundColor: '#F5F5F5',
  padding: '12px',
  borderRadius: '12px',
  lineHeight: '1',
}

const cardLabelStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#666666',
  marginBottom: '8px',
  fontWeight: '500',
}

const cardValueStyle: React.CSSProperties = {
  fontSize: '1.8rem',
  fontWeight: '700',
  color: '#171717',
}

const unitStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: '500',
  color: '#666666',
}

const shortcutStyle: React.CSSProperties = {
  textDecoration: 'none',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E5E5',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center',
  color: '#171717',
  transition: 'background-color 0.2s',
  display: 'block'
}