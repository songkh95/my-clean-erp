'use client'

import React from 'react'
import styles from './StatementModal.module.css'
import Button from '@/components/ui/Button'
import { Settlement, Organization, SettlementDetail } from '@/app/types'

interface Props {
  settlement: Settlement
  supplier: Organization | null
  onClose: () => void
}

export default function StatementModal({ settlement, supplier, onClose }: Props) {
  
  const handlePrint = () => {
    window.print();
  }

  const client = settlement.client || { name: '', representative_name: '', address: '', business_number: '' };
  const year = settlement.billing_year;
  const month = settlement.billing_month;
  const lastDay = new Date(year, month, 0).getDate();
  const dateStr = `${year}년 ${month}월 ${lastDay}일`;

  const supply = settlement.total_amount || 0;
  const vat = Math.floor(supply * 0.1);
  const total = supply + vat;

  return (
    <>
      {/* ✅ [수정] 버튼 영역을 Overlay 밖으로 꺼냈습니다.
        이제 스크롤과 상관없이 화면에 무조건 고정됩니다.
      */}
      <div className={styles.actions}>
        <Button onClick={handlePrint} variant="primary">🖨️ 인쇄하기</Button>
        <Button 
          onClick={onClose} 
          variant="ghost" 
          style={{ 
            backgroundColor: 'white', 
            border: '1px solid #ccc', // 테두리 추가로 시인성 확보
            color: '#333' 
          }}
        >
          닫기
        </Button>
      </div>

      {/* 배경 및 명세서 용지 영역 */}
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
                <td rowSpan={4} className={styles.infoLabel}>공<br/>급<br/>자</td>
                <td className={styles.cellLabel}>등록번호</td>
                <td colSpan={3} style={{ fontWeight: 'bold', fontSize: '11pt', letterSpacing: '2px' }}>
                  {supplier?.business_number || '000-00-00000'}
                </td>
              </tr>
              <tr>
                <td className={styles.cellLabel}>상 호<br/>(법인명)</td>
                <td>{supplier?.name || '(공급자 상호)'}</td>
                <td className={styles.cellLabel}>성 명<br/>(대표자)</td>
                <td>
                  {supplier?.representative_name || '(대표자)'} 
                  <span style={{float:'right', color:'#ddd'}}>(인)</span>
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

              <tr style={{ height: '10px', borderLeft:'none', borderRight:'none' }}><td colSpan={5} style={{border:'none'}}></td></tr>

              <tr>
                <td rowSpan={4} className={styles.infoLabel}>공<br/>급<br/>받<br/>는<br/>자</td>
                <td className={styles.cellLabel}>등록번호</td>
                <td colSpan={3}>{client.business_number || ''}</td>
              </tr>
              <tr>
                <td className={styles.cellLabel}>상 호<br/>(법인명)</td>
                <td style={{ fontWeight: 'bold' }}>{client.name}</td>
                <td className={styles.cellLabel}>성 명<br/>(대표자)</td>
                <td>{client.representative_name}</td>
              </tr>
              <tr>
                <td className={styles.cellLabel}>주 소</td>
                <td colSpan={3}>{client.address}</td>
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
                <th style={{width:'5%'}}>월</th>
                <th style={{width:'5%'}}>일</th>
                <th>품 목 / 규 격</th>
                <th style={{width:'8%'}}>수량</th>
                <th style={{width:'12%'}}>단가</th>
                <th style={{width:'15%'}}>공급가액</th>
                <th style={{width:'12%'}}>세액</th>
                <th style={{width:'15%'}}>비고</th>
              </tr>
            </thead>
            <tbody>
              {settlement.details?.map((detail: SettlementDetail) => {
                const rowSupply = detail.calculated_amount || 0;
                const rowTax = Math.floor(rowSupply * 0.1);
                const model = detail.inventory?.model_name || '복합기 임대료';
                
                return (
                  <tr key={detail.id}>
                    <td style={{textAlign:'center'}}>{month}</td>
                    <td style={{textAlign:'center'}}>{lastDay}</td>
                    <td>{model} ({detail.inventory?.serial_number})</td>
                    <td style={{textAlign:'center'}}>1</td>
                    <td style={{textAlign:'right'}}>{rowSupply.toLocaleString()}</td>
                    <td style={{textAlign:'right'}}>{rowSupply.toLocaleString()}</td>
                    <td style={{textAlign:'right'}}>{rowTax.toLocaleString()}</td>
                    <td style={{textAlign:'center', fontSize:'8pt'}}>
                      흑:{detail.usage_bw?.toLocaleString()} / 칼:{detail.usage_col?.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
              
              {Array.from({ length: Math.max(0, 10 - (settlement.details?.length || 0)) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                <td colSpan={3} style={{textAlign:'center'}}>합 계</td>
                <td colSpan={2}></td>
                <td style={{textAlign:'right'}}>{supply.toLocaleString()}</td>
                <td style={{textAlign:'right'}}>{vat.toLocaleString()}</td>
                <td style={{textAlign:'right'}}>{total.toLocaleString()}</td>
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