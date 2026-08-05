'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AccountingRegistration from '@/components/accounting/AccountingRegistration'
import SettlementConfirmModal from '@/components/accounting/SettlementConfirmModal'
import { useAccounting } from '@/app/accounting/hooks/useAccounting'
import { checkFutureSettlementsAction } from '@/app/actions/accounting'

export default function RegistrationPage() {
  const router = useRouter()
  
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
    prevSourceMap,
    selectedInventories, 
    showUnregistered, setShowUnregistered,
    handleSearch, 
    handleInputChange, 
    toggleInventorySelection, 
    setSelectedInventoriesBulk,
    calculateClientBillFiltered, 
    calculateSelectedTotal, 
    handlePreSave,
    handleFinalSave
  } = useAccounting()

  const handlePreSaveWithValidation = async () => {
    if (selectedInventories.size === 0) return alert('선택된 기계가 없습니다.')

    const targetIds = Array.from(selectedInventories)
    
    for (const invId of targetIds) {
      const result = await checkFutureSettlementsAction(invId, regYear, regMonth)

      if (result.error) {
        alert(result.message || '미래 정산 검증에 실패했습니다. 저장을 중단합니다.')
        return
      }
      
      if (result.hasFuture) {
        const confirmMove = confirm(
          `⚠️ 주의: 선택하신 기계의 ${regYear}년 ${regMonth}월 이후 정산 내역이 이미 존재합니다.\n\n` +
          `지금 수정하면 이후 달의 [전월 지침]과 불일치가 발생할 수 있습니다.\n` +
          `데이터 정합성을 위해 [청구 이력/수정] 페이지로 이동할까요?`
        )

        if (confirmMove) {
          const asset = Object.values(inventoryMap).flat().find(a => a.id === invId)
          const clientId = asset?.client_id || ''
          const params = new URLSearchParams({
            mode: 'timeline',
            inventory_id: invId,
            client_id: clientId,
            focus_year: String(regYear),
            focus_month: String(regMonth),
          })
          router.push(`/accounting/history?${params.toString()}`)
          return
        } else {
          return
        }
      }
    }

    // 당월 입력·전월 폴백 검증 후 모달 오픈
    handlePreSave()
  }

  return (
    <div className="pageShell">
      <h1 className="pageTitle">월 정산 등록</h1>
      
      <AccountingRegistration 
        isRegOpen={true}
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
        prevSourceMap={prevSourceMap}
        selectedInventories={selectedInventories}
        
        handleInputChange={handleInputChange}
        toggleInventorySelection={toggleInventorySelection}
        setSelectedInventoriesBulk={setSelectedInventoriesBulk}
        
        calculateClientBill={calculateClientBillFiltered}
        calculateSelectedTotal={calculateSelectedTotal}
        
        handlePreSave={handlePreSaveWithValidation}
        onSearch={handleSearch}
      />

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
