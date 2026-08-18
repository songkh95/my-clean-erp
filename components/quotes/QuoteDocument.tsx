'use client'

import { useEffect, useState } from 'react'
import { formatQuoteDateKo, formatWon, numberToKoreanWon } from '@/utils/koreanAmount'
import { DEFAULT_FOOTER_NOTICE } from '@/utils/quoteDefaults'
import { getQuoteBrandingAction } from '@/app/actions/quoteBranding'
import { calcQuoteTotals } from '@/utils/quoteTotals'
import styles from './QuoteDocument.module.css'

export type QuoteDocItem = {
  description: string
  unit: string
  quantity: number
  unit_price: number
  amount_text?: string | null
  exclude_from_total?: boolean
}

export type QuoteDocData = {
  title?: string
  quote_no?: string | null
  quote_date: string
  client_name: string
  intro?: string
  notes?: string | null
  footer_notice?: string | null
  vat_rate?: number
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
  items: QuoteDocItem[]
}

function lineSupplyAmount(item: QuoteDocItem): number {
  return Math.round(Number(item.quantity) || 0) * Math.round(Number(item.unit_price) || 0)
}

export default function QuoteDocument({ quote }: { quote: QuoteDocData }) {
  const vatRate = Number(quote.vat_rate) || 10
  const { supply, vat, total } = calcQuoteTotals(quote.items, vatRate)
  const footerNotice = (quote.footer_notice || '').trim() || DEFAULT_FOOTER_NOTICE
  const [stampImage, setStampImage] = useState('')
  const [hqLogo, setHqLogo] = useState('')
  const showLeaseCol = quote.items.some((i) => Boolean(String(i.amount_text || '').trim()))

  useEffect(() => {
    const sync = () => {
      getQuoteBrandingAction().then((res) => {
        setStampImage(res.stampUrl || '')
        setHqLogo(res.hqLogoUrl || '')
      })
    }
    sync()
    window.addEventListener('quote-branding-changed', sync)
    return () => window.removeEventListener('quote-branding-changed', sync)
  }, [])

  return (
    <article className={styles.sheet}>
      <h1 className={styles.title}>{quote.title || '見積書'}</h1>

      <div className={styles.topGrid}>
        <div className={styles.topLeft}>
          <div className={styles.quoteNo}>No. {quote.quote_no || '—'}</div>
          <div className={styles.date}>{formatQuoteDateKo(quote.quote_date)}</div>
          <div className={styles.clientLine}>
            <div className={styles.clientName}>{quote.client_name || '—'}</div>
            <div className={styles.gujung}>貴中</div>
          </div>
          <p className={styles.intro}>{quote.intro || '아래와 같이 見積합니다.'}</p>
        </div>

        <div className={styles.issuerBox}>
          {String(quote.issuer_biz_no || '').trim() ? (
            <div className={styles.issuerRow}>
              <span className={styles.issuerLabel}>사업자번호</span>
              <span className={styles.issuerValue}>{quote.issuer_biz_no}</span>
            </div>
          ) : null}
          {String(quote.issuer_address || '').trim() ? (
            <div className={styles.issuerRow}>
              <span className={styles.issuerLabel}>주 소</span>
              <span className={styles.issuerValue}>{quote.issuer_address}</span>
            </div>
          ) : null}
          {String(quote.issuer_company || '').trim() ? (
            <div className={styles.issuerCompanyLine}>{quote.issuer_company}</div>
          ) : null}
          {String(quote.issuer_partner || '').trim() || stampImage ? (
            <div className={styles.issuerPartnerRow}>
              {String(quote.issuer_partner || '').trim() ? (
                <div className={styles.issuerPartnerLine}>{quote.issuer_partner}</div>
              ) : (
                <div className={styles.issuerPartnerLine} />
              )}
              {stampImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stampImage} alt="도장" className={styles.stampImg} />
              ) : null}
            </div>
          ) : null}
          {String(quote.issuer_ceo || '').trim() ? (
            <div className={styles.issuerCeoLine}>
              <span>대표 {quote.issuer_ceo}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.totalBox}>
        <span className={styles.totalLabel}>합 계 금 액</span>
        <span className={styles.totalGold}>金</span>
        <span className={styles.totalKorean}>{numberToKoreanWon(total)}</span>
        <span className={styles.totalWon}>{formatWon(total)}</span>
      </div>

      <table className={`${styles.table} ${showLeaseCol ? styles.tableWithLease : ''}`}>
        <thead>
          <tr>
            <th className={styles.colDesc}>품 명</th>
            <th className={styles.colUnit}>단 위</th>
            <th className={styles.colQty}>수 량</th>
            <th className={styles.colPrice}>단 가</th>
            <th className={styles.colAmount}>공급가액</th>
            {showLeaseCol ? <th className={styles.colLease}>임대정보</th> : null}
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item, idx) => {
            const leaseText = String(item.amount_text || '').trim()
            return (
              <tr key={idx}>
                <td className={styles.colDesc}>
                  {item.description}
                  {item.exclude_from_total ? (
                    <div className={styles.muted}>(합계 제외)</div>
                  ) : null}
                </td>
                <td className={styles.colUnit}>{item.unit || '대'}</td>
                <td className={styles.colQty}>{Number(item.quantity) || 0}</td>
                <td className={styles.colPrice}>{formatWon(item.unit_price)}</td>
                <td className={styles.colAmount}>{formatWon(lineSupplyAmount(item))}</td>
                {showLeaseCol ? (
                  <td className={`${styles.colLease} ${styles.leaseText}`}>{leaseText}</td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className={styles.summaryWrap}>
        <table className={styles.summaryTable}>
          <tbody>
            <tr className={styles.summaryRow}>
              <td className={styles.summaryLabel}>소 계</td>
              <td className={styles.summaryValue}>{formatWon(supply)}</td>
            </tr>
            <tr className={styles.summaryRow}>
              <td className={styles.summaryLabel}>부가세 {vatRate}%</td>
              <td className={styles.summaryValue}>{formatWon(vat)}</td>
            </tr>
            <tr className={styles.summaryRow}>
              <td className={styles.summaryLabel}>합 계</td>
              <td className={styles.summaryValue}>{formatWon(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.notes}>
        <div className={styles.notesTitle}>* 비 고</div>
        <div>{quote.notes || ''}</div>
      </div>

      <div className={styles.footerNotice}>
        {String(footerNotice || '').trim() ? <div>{footerNotice}</div> : null}
        {(String(quote.issuer_homepage || '').trim() || String(quote.issuer_blog || '').trim()) ? (
          <div style={{ marginTop: 4 }}>
            {String(quote.issuer_homepage || '').trim() ? (
              <span>■ 홈페이지: {quote.issuer_homepage}</span>
            ) : null}
            {String(quote.issuer_homepage || '').trim() && String(quote.issuer_blog || '').trim()
              ? ' '
              : null}
            {String(quote.issuer_blog || '').trim() ? (
              <span>■ 블로그: {quote.issuer_blog}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.footerBrand}>
        <div className={styles.footerLeft}>
          {String(quote.issuer_company || '').trim() ? (
            <div className={styles.footerCompany}>{quote.issuer_company}</div>
          ) : null}
          {String(quote.issuer_partner || '').trim() ? (
            <div className={styles.footerPartner}>{quote.issuer_partner}</div>
          ) : null}
          {(() => {
            const parts: string[] = []
            if (String(quote.issuer_manager || '').trim()) {
              parts.push(`담당자: ${quote.issuer_manager}`)
            }
            if (String(quote.issuer_tel || '').trim()) {
              parts.push(`TEL: ${quote.issuer_tel}`)
            }
            if (String(quote.issuer_hp || '').trim()) {
              parts.push(`HP: ${quote.issuer_hp}`)
            }
            if (parts.length === 0) return null
            return <div className={styles.footerContact}>{parts.join('  ')}</div>
          })()}
        </div>
        {hqLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hqLogo} alt="본사 로고" className={styles.hqLogo} />
        ) : null}
      </div>
    </article>
  )
}
