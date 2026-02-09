'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AccountingRegistration from '@/components/accounting/AccountingRegistration'
import SettlementConfirmModal from '@/components/accounting/SettlementConfirmModal'
import { useAccounting } from '@/app/accounting/hooks/useAccounting'
import { checkFutureSettlementsAction } from '@/app/actions/accounting'

export default function RegistrationPage() {
  const router = useRouter()
  
  // useAccounting 훅에서 등록 페이지에 필요한 상태와 함수만 가져옵니다.
  const {
    loading,
    isModalOpen, setIsModalOpen,
    regYear, setRegYear, 
    regMonth, setRegMonth, 
    targetDay, setTargetDay, 
    searchTerm, setSearchTerm,
    isRegOpen, setIsRegOpen,
    filteredClients, 
    inventoryMap, 
    inputData, 
    prevData, 
    selectedInventories, 
    showUnregistered, setShowUnregistered,
    handleSearch, 
    handleInputChange, 
    toggleInventorySelection, 
    setSelectedInventoriesBulk,
    calculateClientBillFiltered, 
    calculateSelectedTotal, 
    handleFinalSave, 
    handleExcludeAsset
  } = useAccounting()

  // [NEW] 저장 전 검증 로직: 미래 데이터가 있으면 저장을 막고 이력 수정으로 유도
  const handlePreSaveWithValidation = async () => {
    if (selectedInventories.size === 0) return alert('선택된 기계가 없습니다.')

    // 선택된 기계 ID 목록 추출
    const targetIds = Array.from(selectedInventories)
    
    // 선택된 기계들에 대해 미래 정산 내역이 존재하는지 서버 액션으로 확인
    for (const invId of targetIds) {
      const { hasFuture } = await checkFutureSettlementsAction(invId, regYear, regMonth)
      
      if (hasFuture) {
        // 미래 데이터가 발견되면 경고 및 페이지 이동 제안
        const confirmMove = confirm(
          `⚠️ 주의: 선택하신 기계(ID: ...${invId.slice(-4)})의 ${regYear}년 ${regMonth}월 이후 정산 내역이 이미 존재합니다.\n\n` +
          `지금 수정하면 이후 달의 [전월 지침]과 불일치가 발생합니다.\n` +
          `데이터 정합성을 위해 **[이력 수정 모드]**로 이동하여 조정하시겠습니까?`
        )

        if (confirmMove) {
          // 해당 기계의 타임라인 수정 페이지로 이동 (포커스 파라미터 포함)
          router.push(`/accounting/history?mode=timeline&inventory_id=${invId}&focus_year=${regYear}&focus_month=${regMonth}`)
          return // 저장 프로세스 중단
        } else {
          return // 취소 시 현 페이지 유지
        }
      }
    }

    // 문제가 없으면 최종 확인 모달 오픈
    setIsModalOpen(true)
  }

  return (
    <div style={{ padding: '0 30px', maxWidth: '1600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', margin: '30px 0 20px', color:'#171717' }}>
        📝 월 정산 등록
      </h1>
      
      {/* 등록 컴포넌트 (UI) */}
      <AccountingRegistration 
        isRegOpen={true} // 항상 펼침 상태
        setIsRegOpen={setIsRegOpen}
        regYear={regYear} setRegYear={setRegYear}
        regMonth={regMonth} setRegMonth={setRegMonth}
        targetDay={targetDay} setTargetDay={setTargetDay}
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        showUnregistered={showUnregistered} setShowUnregistered={setShowUnregistered}
        loading={loading}
        
        filteredClients={filteredClients}
        inventoryMap={inventoryMap}
        inputData={inputData}
        prevData={prevData}
        selectedInventories={selectedInventories}
        
        handleInputChange={handleInputChange}
        toggleInventorySelection={toggleInventorySelection}
        setSelectedInventoriesBulk={setSelectedInventoriesBulk}
        
        calculateClientBill={calculateClientBillFiltered}
        calculateSelectedTotal={calculateSelectedTotal}
        
        handlePreSave={handlePreSaveWithValidation} // 검증 로직이 포함된 핸들러 전달
        onSearch={handleSearch}
        handleExcludeAsset={handleExcludeAsset}
      />

      {/* 최종 확인 및 저장 모달 */}
      {isModalOpen && (
        <SettlementConfirmModal 
           onClose={() => setIsModalOpen(false)} 
           onSave={handleFinalSave}
           
           selectedInventories={selectedInventories}
           calculateSelectedTotal={calculateSelectedTotal}
           clients={filteredClients}
           inventoryMap={inventoryMap}
           calculateClientBill={calculateClientBillFiltered}
           loading={loading}
        />
      )}
    </div>
  )
}