'use client'

import React from 'react'
import styles from './StatementModal.module.css'
import Button from '@/components/ui/Button'
import { Settlement, Organization, SettlementDetail } from '@/app/types'
import { calcVat, calcGrandTotal } from '@/utils/billingAmounts'

interface Props {
  settlement: Settlement
  supplier: Organization | null
  onClose: () => void
}

export default function StatementModal({ settlement, supplier, onClose }: Props) {
  const handlePrint = () => {
    window.print()
  }

  const client = settlement.client || {
    name: '',
    representative_name: '',
    address: '',
    business_number: '',
  }
  const year = settlement.billing_year
  const month = settlement.billing_month
  const lastDay = new Date(year, month, 0).getDate()
  const dateStr = `${year}년 ${month}월 ${lastDay}일`

  // calculated_amount = 공급가, total_amount = 공급가+VAT(10원 절사). 이중 가산 금지.
  const supply =
    settlement.details?.reduce((sum, d) => sum + (d.calculated_amount || 0), 0) || 0
  const vat = calcVat(supply)
  const total =
    settlement.total_amount != null && settlement.total_amount > 0
      ? settlement.total_amount
      : calcGrandTotal(supply)

  return (
    <>
      <div className={styles.actions}>
        <Button onClick={handlePrint} variant="primary">
          🖨️ 인쇄하기
        </Button>
        <Button
          onClick={onClose}
          variant="ghost"
          style={{
            backgroundColor: 'white',
            border: '1px solid #ccc',
            color: '#333',
          }}
        >
          닫기
        </Button>
      </div>

      <div className={styles.overlay}>
        <div className={styles.sheet}>
          <h1 className={styles.title}>거 래 명 세 서</h1>

          <div className={styles.headerRow}>
            <div className={styles.docNo}> ( 보관용 ) </div>
            <div className={styles.docNo}> 작성일자 : {dateStr} </div>
          </div>

          <table className={styles.infoTable}>
            <tbody>
              <tr>
                <td rowSpan={4} className={styles.infoLabel}>
                  공<br />급<br />자
                </td>
                <td className={styles.cellLabel}>등록번호</td>
                <td
                  colSpan={3}
                  style={{ fontWeight: 'bold', fontSize: '11pt', letterSpacing: '2px' }}
                >
                  {supplier?.business_number || '000-00-00000'}
                </td>
              </tr>
              <tr>
                <td className={styles.cellLabel}>
                  상 호<br />
                  (법인명)
                </td>
                <td>{supplier?.name || '(공급자 상호)'}</td>
                <td className={styles.cellLabel}>
                  성 명<br />
                  (대표자)
                </td>
                <td>
                  {supplier?.representative_name || '(대표자)'}
                  <span style={{ float: 'right', color: '#ddd' }}>(인)</span>
                </td>
              </tr>
              <tr>
                <td className={styles.cellLabel}>주 소</td>
                <td colSpan={3}>{supplier?.address || '(공급자 주소)'}</td>
              </tr>
              <tr>
                <td className={styles.cellLabel}>업 태</td>
                <td>서비스/임대</td>
                <td className={styles.cellLabel}>종 목</td>
                <td>사무기기</td>
              </tr>

              <tr style={{ height: '10px', borderLeft: 'none', borderRight: 'none' }}>
                <td colSpan={5} style={{ border: 'none' }}></td>
              </tr>

              <tr>
                <td rowSpan={4} className={styles.infoLabel}>
                  공<br />급<br />받<br />는<br />자
                </td>
                <td className={styles.cellLabel}>등록번호</td>
                <td colSpan={3}>{client.business_number || ''}</td>
              </tr>
              <tr>
                <td className={styles.cellLabel}>
                  상 호<br />
                  (법인명)
                </td>
                <td style={{ fontWeight: 'bold' }}>{client.name}</td>
                <td className={styles.cellLabel}>
                  성 명<br />
                  (대표자)
                </td>
                <td>{client.representative_name}</td>
              </tr>
              <tr>
                <td className={styles.cellLabel}>주 소</td>
                <td colSpan={3}>
                  {[client.address, (client as { address_detail?: string | null }).address_detail]
                    .map((s) => String(s || '').trim())
                    .filter(Boolean)
                    .join(' ') || ''}
                </td>
              </tr>
              <tr>
                <td className={styles.cellLabel}>비 고</td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>

          <table className={styles.itemTable}>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>월</th>
                <th style={{ width: '5%' }}>일</th>
                <th>품 목 / 규 격</th>
                <th style={{ width: '8%' }}>수량</th>
                <th style={{ width: '12%' }}>단가</th>
                <th style={{ width: '15%' }}>공급가액</th>
                <th style={{ width: '12%' }}>세액</th>
                <th style={{ width: '15%' }}>비고</th>
              </tr>
            </thead>
            <tbody>
              {settlement.details?.map((detail: SettlementDetail) => {
                const rowSupply = detail.calculated_amount || 0
                const rowTax = calcVat(rowSupply)
                const model = detail.inventory?.model_name || '복합기 임대료'

                return (
                  <tr key={detail.id}>
                    <td style={{ textAlign: 'center' }}>{month}</td>
                    <td style={{ textAlign: 'center' }}>{lastDay}</td>
                    <td>
                      {model} ({detail.inventory?.serial_number})
                    </td>
                    <td style={{ textAlign: 'center' }}>1</td>
                    <td style={{ textAlign: 'right' }}>{rowSupply.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{rowSupply.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{rowTax.toLocaleString()}</td>
                    <td style={{ textAlign: 'center', fontSize: '8pt' }}>
                      흑:{detail.usage_bw?.toLocaleString()} / 칼:{detail.usage_col?.toLocaleString()}
                    </td>
                  </tr>
                )
              })}

              {Array.from({ length: Math.max(0, 10 - (settlement.details?.length || 0)) }).map(
                (_, i) => (
                  <tr key={`empty-${i}`}>
                    <td>&nbsp;</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                )
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                <td colSpan={3} style={{ textAlign: 'center' }}>
                  합 계
                </td>
                <td colSpan={2}></td>
                <td style={{ textAlign: 'right' }}>{supply.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{vat.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{total.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          <div className={styles.totalArea}>
            청구 금액 (VAT 포함) : ￦ {total.toLocaleString()} 원정
          </div>

          <div className={styles.footer}>
            <p>위와 같이 청구합니다.</p>
          </div>
        </div>
      </div>
    </>
  )
}
