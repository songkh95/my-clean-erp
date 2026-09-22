'use client'

import { useState } from 'react'
import { Download, Printer, Search, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import ComboBoxSelect from '@/components/ui/ComboBoxSelect'
import SuggestInput from '@/components/ui/SuggestInput'
import PanelRefreshButton from '@/components/ui/PanelRefreshButton'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Tabs from '@/components/ui/Tabs'
import PageHeader from '@/components/ui/PageHeader'
import FilterBar from '@/components/ui/FilterBar'
import EmptyState from '@/components/ui/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { toast } from '@/components/ui/Toast'
import styles from './preview.module.css'

const ROWS = [
  { date: '2026.09.01', client: '한빛상사', qty: 12, amount: 1234000, status: 'paid' as const },
  { date: '2026.09.05', client: '새솔물산', qty: 3, amount: 480000, status: 'pending' as const },
  { date: '2026.09.12', client: '동해유통', qty: 40, amount: 5620000, status: 'overdue' as const },
]

const STATUS = {
  paid: { tone: 'success' as const, label: '수금' },
  pending: { tone: 'warning' as const, label: '대기' },
  overdue: { tone: 'danger' as const, label: '미수' },
}

const won = (n: number) => n.toLocaleString('ko-KR')

type TabId = 'buttons' | 'inputs' | 'table'

export default function UiPreview() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<TabId>('buttons')
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('all')
  const [client, setClient] = useState('')
  const [model, setModel] = useState('')
  const [memo, setMemo] = useState('')
  const [lastResult, setLastResult] = useState('')

  const total = ROWS.reduce((s, r) => s + r.amount, 0)

  return (
    <div>
      <PageHeader
        title="UI 컴포넌트"
        description="DESIGN_SYSTEM.md 7장의 공통 부품 미리보기입니다. 개발 모드에서만 열립니다."
        actions={
          <>
            <Button variant="secondary">엑셀</Button>
            <Button variant="primary" onClick={() => setModalOpen(true)}>모달 열기</Button>
          </>
        }
      />

      <FilterBar summary={<>총 {ROWS.length}건 · 합계 {won(total)}<span className={styles.unit}>원</span></>}>
        <InputField label="검색" placeholder="거래처명" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="구분" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">전체</option>
          <option value="paid">수금</option>
          <option value="unpaid">미수</option>
        </Select>
        <Button variant="primary">
          <Search size="1em" strokeWidth={1.5} aria-hidden />
          조회
        </Button>
      </FilterBar>

      <Tabs<TabId>
        aria-label="미리보기 구역"
        items={[
          { id: 'buttons', label: '버튼과 알림' },
          { id: 'inputs', label: '입력' },
          { id: 'table', label: '표와 배지' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className={styles.body}>
        {tab === 'buttons' && (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>버튼</h2>
              <div className={styles.row}>
                <Button variant="primary">저장</Button>
                <Button variant="danger">취소</Button>
                <Button variant="secondary">보조 (닫기, 엑셀)</Button>
                <Button variant="ghost">ghost + 글자 = 보조</Button>
                <Button variant="danger">삭제</Button>
                <Button variant="primary" disabled>비활성</Button>
              </div>
              <div className={styles.row}>
                <Button variant="primary" size="sm">저장</Button>
                <Button variant="secondary" size="sm">
                  <Printer size="1em" strokeWidth={1.5} aria-hidden />
                  인쇄
                </Button>
                <Button variant="secondary" size="sm">
                  <Download size="1em" strokeWidth={1.5} aria-hidden />
                  다운로드
                </Button>
                <Button variant="ghost" size="sm" iconOnly aria-label="닫기">
                  <X size="1em" strokeWidth={1.5} aria-hidden />
                </Button>
                <PanelRefreshButton onRefresh={() => new Promise((r) => setTimeout(r, 800))} />
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>확인창과 토스트</h2>
              <div className={styles.row}>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const ok = await confirm({ title: '저장할까요?', description: '입력한 정산 내역을 저장합니다.' })
                    setLastResult(ok ? '확인' : '취소')
                  }}
                >
                  일반 확인
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    const ok = await confirm({
                      title: '거래처를 삭제할까요?',
                      description: '삭제하면 되돌릴 수 없습니다.\n연결된 청구 이력은 남습니다.',
                      confirmLabel: '삭제',
                      danger: true,
                    })
                    setLastResult(ok ? '삭제' : '취소')
                  }}
                >
                  삭제 확인
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await confirm({ title: '저장하지 못했습니다', description: '네트워크 연결을 확인해 주세요.', alertOnly: true })
                    setLastResult('확인 (알림)')
                  }}
                >
                  오류 알림
                </Button>
                <Button variant="secondary" onClick={() => toast('저장했습니다.')}>토스트</Button>
                <Button variant="secondary" onClick={() => toast.error('저장하지 못했습니다.')}>오류 토스트</Button>
              </div>
              {lastResult ? <p className={styles.note}>마지막 결과: {lastResult}</p> : null}
            </section>
          </>
        )}

        {tab === 'inputs' && (
          <section className={`${styles.section} ${styles.narrow}`}>
            <h2 className={styles.sectionTitle}>입력</h2>
            <InputField label="거래처명" placeholder="예: 한빛상사" value={name} onChange={(e) => setName(e.target.value)} />
            <InputField label="사업자번호" value="123-45" readOnly hint="읽기 전용 입력" />
            <InputField label="연락처" value="010-12" onChange={() => {}} error="전화번호 형식이 올바르지 않습니다." />
            <ComboBoxSelect
              label="거래처 선택"
              value={client}
              onChange={setClient}
              placeholder="이름으로 검색"
              options={ROWS.map((r) => ({ id: r.client, label: r.client, hint: r.date }))}
            />
            <SuggestInput
              label="모델명"
              value={model}
              onChange={setModel}
              transform={(v) => v.toUpperCase()}
              suggestions={['CX-200', 'CX-210', 'DX-900']}
            />
            <InputField as="textarea" label="메모" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </section>
        )}

        {tab === 'table' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>표와 배지</h2>
            <Table>
              <thead>
                <tr>
                  <th className="center">날짜</th>
                  <th>거래처</th>
                  <th className="num">수량</th>
                  <th className="num">금액</th>
                  <th className="center">상태</th>
                  <th className="num" aria-label="동작" />
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.client}>
                    <td className="center">{r.date}</td>
                    <td>{r.client}</td>
                    <td className="num">{r.qty}</td>
                    <td className="num">{won(r.amount)}<span className="unit">원</span></td>
                    <td className="center"><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></td>
                    <td className="num"><Button variant="ghost" size="sm">수정</Button></td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={3}>합계</td>
                  <td className="num">{won(total)}<span className="unit">원</span></td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </Table>
            <div className={styles.row}>
              <Badge tone="success">완료</Badge>
              <Badge tone="warning">기한 임박</Badge>
              <Badge tone="danger">미수</Badge>
              <Badge>기타</Badge>
            </div>
            <EmptyState>조건에 맞는 청구 이력이 없습니다.</EmptyState>
          </section>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="월 정산 등록"
        footer={
          <>
            <Button variant="danger" onClick={() => setModalOpen(false)}>취소</Button>
            <Button variant="primary" onClick={() => { setModalOpen(false); toast('등록했습니다.') }}>등록</Button>
          </>
        }
      >
        <InputField label="거래처명" value={name} onChange={(e) => setName(e.target.value)} />
        <InputField label="금액" value="1,234,000" onChange={() => {}} />
      </Modal>
    </div>
  )
}
