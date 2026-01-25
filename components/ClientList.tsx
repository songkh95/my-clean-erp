'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import styles from './ClientList.module.css'

export default function ClientList({ refreshTrigger }: { refreshTrigger: number }) {
  const [isListOpen, setIsListOpen] = useState(true)
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [clientAssets, setClientAssets] = useState<any[]>([])

  const supabase = createClient()

  const fetchClients = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      if (profile?.organization_id) {
        const { data } = await supabase
          .from('clients')
          .select('*, parent:parent_id(name)')
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
        if (data) setClients(data)
      }
    }
    setLoading(false)
  }

  useEffect(() => { fetchClients() }, [refreshTrigger])

  const fetchClientAssets = async (clientId: string) => {
    // 🔴 [수정] 철수된 기계도 이력에는 남겨야 하므로 모두 가져오되, 정렬
    const { data } = await supabase.from('inventory')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (data) setClientAssets(data)
    else setClientAssets([])
  }

  // 1. 단순 철수 기능
  const handleWithdrawAsset = async (assetId: string, modelName: string) => {
    if (confirm(`[${modelName}] 장비를 단순 철수(창고 반환) 하시겠습니까?`)) {
      const { error } = await supabase.from('inventory').update({ status: '창고', client_id: null }).eq('id', assetId)
      if (!error) {
        alert('철수 완료! 창고로 이동되었습니다.')
        if (expandedId) fetchClientAssets(expandedId)
      } else { alert(error.message) }
    }
  }

  // 🔴 2. [추가] 기계 교체 기능
  const handleReplaceAsset = async (assetId: string, modelName: string) => {
    if (confirm(`[${modelName}] 장비를 '교체(철수)' 처리 하시겠습니까?\n\n확인 시:\n1. 이 장비는 '교체전(철수)' 상태가 됩니다.\n2. 정산 시 교체 전 데이터로 사용됩니다.\n3. 이후 [자산 및 재고] 탭에서 새 기계를 등록해주세요.`)) {
      // 상태를 '교체전'으로 변경 (정산 시 식별용)
      const { error } = await supabase.from('inventory')
        .update({ status: '교체전(철수)' }) // client_id는 유지해야 정산 내역에 뜸
        .eq('id', assetId)

      if (!error) {
        alert('처리되었습니다. \n이제 [자산 및 재고] 탭에서 교체할 새 기계를 등록해주세요.')
        if (expandedId) fetchClientAssets(expandedId)
      } else {
        alert('오류 발생: ' + error.message)
      }
    }
  }

  const startEditing = (client: any) => {
    setEditingId(client.id)
    setEditData({ ...client })
  }

  const handleUpdate = async () => {
    if (!editData.name) return alert('업체명은 필수입니다.')
    const { parent, id, created_at, organization_id, ...cleanData } = editData
    if (cleanData.parent_id === "") cleanData.parent_id = null
    const { error } = await supabase.from('clients').update(cleanData).eq('id', editingId)
    if (!error) { alert('수정완료'); setEditingId(null); fetchClients(); }
  }

const handleDelete = async (id: string, name: string) => {
    // 🔴 요청하신 경고 문구 적용
    if (confirm(`'${name}' 거래처를 정말로 삭제하시겠습니까?\n삭제 시 등록된 기기 이력은 사라지며 상태는 창고로 전환됩니다.`)) { 
      
      // 1. [선행 작업] 이 거래처에 연결된 기계들의 연결을 해제하고 '창고'로 변경
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ status: '창고', client_id: null })
        .eq('client_id', id) // 여기서 id는 삭제하려는 거래처의 ID입니다.

      if (updateError) {
        alert('기기 상태 변경(철수 처리) 중 오류가 발생했습니다: ' + updateError.message)
        return // 기기 처리에 실패하면 거래처 삭제를 진행하지 않고 멈춤
      }

      // 2. [삭제 작업] 기계 연결이 끊어졌으니, 이제 안전하게 거래처 삭제
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)

      if (deleteError) {
        alert('거래처 삭제 실패: ' + deleteError.message)
      } else {
        alert('성공적으로 삭제되었습니다.')
        fetchClients() // 목록 새로고침
      }
    }
  }

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase()
    return (
      (client.name && String(client.name).toLowerCase().includes(searchLower)) ||
      (client.contact_person && String(client.contact_person).toLowerCase().includes(searchLower)) ||
      (client.business_number && String(client.business_number).includes(searchTerm))
    )
  })

  if (loading) return <div style={{ padding: '20px' }}>데이터 로딩 중...</div>

  return (
    <div className={styles.container}>
      <div 
        onClick={() => setIsListOpen(!isListOpen)} 
        className={`${styles.header} ${!isListOpen ? styles.headerClosed : ''}`}
      >
        <span>📋 등록된 거래처 목록 ({searchTerm ? filteredClients.length : clients.length})</span>
        <span>{isListOpen ? '▲' : '▼'}</span>
      </div>

      {isListOpen && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="업체명, 담당자명, 번호 등으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.listHeader}>
            <div style={{ flex: 2 }}>업체명 (본사/지사)</div>
            <div style={{ flex: 1 }}>담당자</div>
            <div style={{ flex: 1, textAlign: 'right' }}>등록일</div>
          </div>

          {filteredClients.length === 0 ? (
            <div className={styles.noResult}>결과가 없습니다.</div>
          ) : (
            filteredClients.map((client) => {
              const isHead = !client.parent_id;
              return (
                <div key={client.id} className={styles.clientRow}>
                  <div 
                    onClick={() => { 
                      const newId = expandedId === client.id ? null : client.id;
                      setExpandedId(newId); 
                      setEditingId(null);
                      if (newId) fetchClientAssets(newId);
                    }} 
                    className={`${styles.clientSummary} ${expandedId === client.id ? styles.clientSummarySelected : ''}`}
                  >
                    <div style={{ flex: 2, display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold' }}>{client.name}</span>
                      <span className={`${styles.badge} ${isHead ? styles.badgeHead : styles.badgeBranch}`}>
                        {isHead ? '본사' : '지사'}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>{client.contact_person || '-'}</div>
                    <div style={{ flex: 1, textAlign: 'right', fontSize: '0.8rem', color: '#888' }}>{new Date(client.created_at).toLocaleDateString()}</div>
                  </div>

                  {expandedId === client.id && (
                    <div className={styles.detailsContainer}>
                      
                      {/* 상세 정보 수정 */}
                      <div style={{ marginBottom: '20px' }}>
                         <div className={styles.sectionTitle}>👤 거래처 기본 정보</div>
                         <div className={styles.gridForm}>
                            <EditableItem label="업체명" name="name" value={client.name} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="사업자번호" name="business_number" value={client.business_number} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="대표자명" name="representative_name" value={client.representative_name} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="담당자명" name="contact_person" value={client.contact_person} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="휴대폰" name="phone" value={client.phone} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="사무실" name="office_phone" value={client.office_phone} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="이메일" name="email" value={client.email} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="상태" name="status" value={client.status} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} isSelect />
                            <EditableItem label="주소" name="address" value={client.address} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} fullWidth />
                            
                            {/* 🔴 [추가] 요금제 수정 필드 */}
                            <div className={styles.fullWidth} style={{marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px'}}>
                                <span style={{fontWeight: 'bold', fontSize: '0.85rem', color: '#0070f3'}}>💰 요금제 설정</span>
                            </div>
                            <EditableItem label="청구일" name="billing_date" value={client.billing_date} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="기본료" name="basic_fee" value={client.basic_fee} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="흑백기본" name="basic_cnt_bw" value={client.basic_cnt_bw} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="칼라기본" name="basic_cnt_col" value={client.basic_cnt_col} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="흑백추가" name="extra_cost_bw" value={client.extra_cost_bw} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="칼라추가" name="extra_cost_col" value={client.extra_cost_col} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                         </div>
                         
                         <div className={styles.buttonGroup}>
                          {editingId === client.id ? 
                            ( <><button onClick={handleUpdate} className={`${styles.btn} ${styles.btnSave}`}>저장</button><button onClick={()=>setEditingId(null)} className={`${styles.btn} ${styles.btnCancel}`}>취소</button></> ) : 
                            ( <><button onClick={()=>startEditing(client)} className={`${styles.btn} ${styles.btnEdit}`}>정보 수정</button><button onClick={()=>handleDelete(client.id, client.name)} className={`${styles.btn} ${styles.btnDelete}`}>거래처 삭제</button></> )
                          }
                        </div>
                      </div>

                      <hr className={styles.divider} />

                      {/* 설치된 자산 목록 */}
                      <div className={styles.assetContainer}>
                        <div className={styles.sectionTitle}>📦 설치된 자산 목록 ({clientAssets.length})</div>
                        {clientAssets.length === 0 ? (
                          <div className={styles.assetEmpty}>설치된 장비가 없습니다.</div>
                        ) : (
                          <table className={styles.assetTable}>
                            <thead>
                              <tr>
                                <th className={styles.assetTh}>분류</th>
                                <th className={styles.assetTh}>모델명</th>
                                <th className={styles.assetTh}>S/N</th>
                                <th className={styles.assetTh}>상태</th>
                                <th style={{...thStyleCenter}}>관리</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientAssets.map((asset) => (
                                <tr key={asset.id} style={{ opacity: asset.status.includes('철수') ? 0.6 : 1 }}>
                                  <td className={styles.assetTd}>{asset.category}</td>
                                  <td className={styles.assetTd} style={{fontWeight:'bold'}}>{asset.model_name}</td>
                                  <td className={styles.assetTd}>{asset.serial_number}</td>
                                  <td className={styles.assetTd}>{asset.status}</td>
                                  <td className={styles.assetTd} style={{textAlign:'center', display:'flex', gap:'5px', justifyContent:'center'}}>
                                    {/* 🔴 교체 버튼 & 철수 버튼 */}
                                    {!asset.status.includes('철수') && (
                                      <>
                                        <button 
                                          onClick={() => handleReplaceAsset(asset.id, asset.model_name)}
                                          className={styles.btnWithdraw}
                                          style={{borderColor: '#0070f3', color: '#0070f3'}}
                                        >
                                          🔄 교체
                                        </button>
                                        <button 
                                          onClick={() => handleWithdrawAsset(asset.id, asset.model_name)}
                                          className={styles.btnWithdraw}
                                        >
                                          철수
                                        </button>
                                      </>
                                    )}
                                    {asset.status.includes('철수') && <span style={{fontSize:'0.75rem', color:'#d93025'}}>철수됨</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function EditableItem({ label, name, value, isEditing, editData, setEditData, fullWidth = false, isSelect = false }: any) {
  const handleChange = (e: any) => setEditData({ ...editData, [name]: e.target.value })
  return (
    <div className={`${styles.fieldContainer} ${fullWidth ? styles.fullWidth : ''}`}>
      <span className={styles.label}>{label}</span>
      {isEditing ? (
        isSelect ? (
          <select value={editData[name]} onChange={handleChange} className={styles.input}>
            <option value="정상">정상</option><option value="중지">중지</option><option value="해지">해지</option>
          </select>
        ) : (
          <input value={editData[name] || ''} onChange={handleChange} className={styles.input} />
        )
      ) : (
        <span className={styles.valueText}>{value || '-'}</span>
      )}
    </div>
  )
}

const thStyleCenter = { padding: '8px 10px', textAlign: 'center', color: '#555', fontSize: '0.8rem', backgroundColor: '#f1f3f5', borderBottom: '1px solid #ddd' } as const