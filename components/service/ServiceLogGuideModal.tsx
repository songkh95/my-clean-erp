'use client'

import type { CSSProperties } from 'react'
import styles from '@/app/service/service.module.css'
import Button from '@/components/ui/Button'

type Props = {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export default function ServiceLogGuideModal({
  isOpen,
  onClose,
  title = '서비스 일지 · 소모품 사용 안내',
}: Props) {
  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ width: 640, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>{title}</h2>
        <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.5 }}>
          일지에서 쓰는 소모품·부품은 재고 품목과 연결됩니다. 완료 저장 시 재고가 차감되고,
          부족분은 미입고(가출고)로 남습니다.
        </p>

        <section style={{ marginBottom: 16 }}>
          <h3 style={h3}>A. 이 기기 호환 재고가 있을 때</h3>
          <ol style={ol}>
            <li>서비스 일지 작성</li>
            <li>사용된 소모품/부품 선택 (토너·드럼 KCMY, 부품, 폐토너통·현상기·용지 등)</li>
            <li>선택 목록에 수량 반영</li>
            <li>
              <strong>완료</strong> 저장 시 재고 − (부족분은 미입고)
            </li>
            <li>수정·삭제 시 재고 복구/재배분</li>
          </ol>
        </section>

        <section style={{ marginBottom: 16 }}>
          <h3 style={h3}>B. 이 기기 호환 재고가 없을 때</h3>
          <ol style={ol}>
            <li>소모품/부품 선택 → “이 기기 모델에 호환된 품목이 없음” 감지</li>
            <li>
              <strong>기존 재고에서 선택</strong> 또는 <strong>새로 등록</strong>
            </li>
          </ol>
        </section>

        <section style={{ marginBottom: 16 }}>
          <h3 style={h3}>B-1. 기존 재고에서 선택 → 호환 추가 후 사용</h3>
          <p style={p}>
            이미 있는 재고를 쓰고, 그 품목에 <strong>지금 일지 기기 모델</strong>을 호환으로 붙여
            다음부터는 A처럼 바로 쓰게 합니다.
          </p>
          <ol style={ol}>
            <li>소모품/부품 표를 체크박스로 선택 (토너·드럼은 종류·색상·재생이 맞는 항목)</li>
            <li>
              확인 시 <strong>호환 추가</strong> (선택한 품목에 현재 기기 모델 연결)
            </li>
            <li>
              <strong>이번 일지 사용 목록</strong>에 반영 (기본 수량 1)
            </li>
            <li>일지 <strong>완료</strong> 시 재고 − / 부족 시 미입고</li>
          </ol>
          <p style={{ ...p, color: '#059669' }}>
            체크 = “이 재고를 이 기기에 쓸 수 있게 연결” + “이번 일지에 사용으로 넣기”
          </p>
        </section>

        <section style={{ marginBottom: 16 }}>
          <h3 style={h3}>B-2. 새로 등록</h3>
          <ol style={ol}>
            <li>자재 등록 팝업 (현재 기기 모델이 호환에 미리 채워짐)</li>
            <li>저장 → 일지 사용 목록에 반영</li>
            <li>완료 시 재고 − (0이면 미입고)</li>
          </ol>
        </section>

        <section style={{ marginBottom: 18 }}>
          <h3 style={h3}>하지 않는 것</h3>
          <ul style={{ ...ol, listStyleType: 'disc' }}>
            <li>같은 색상 다른 품목에 시스템이 임의로 호환을 붙이지 않습니다.</li>
            <li>사용자가 고르거나 새로 등록한 품목만 연결·사용됩니다.</li>
          </ul>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" type="button" onClick={onClose}>
            확인
          </Button>
        </div>
      </div>
    </div>
  )
}

const h3: CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 700,
  margin: '0 0 8px',
  color: '#111827',
}

const ol: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: '0.82rem',
  color: '#374151',
  lineHeight: 1.55,
}

const p: CSSProperties = {
  margin: '0 0 8px',
  fontSize: '0.8rem',
  color: '#4b5563',
  lineHeight: 1.5,
}
