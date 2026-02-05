'use client'

import styles from './accounting.module.css'
import AccountingRegistration from '@/components/accounting/AccountingRegistration'
import AccountingHistory from '@/components/accounting/AccountingHistory'
import SettlementConfirmModal from '@/components/accounting/SettlementConfirmModal'
import StatementModal from '@/components/accounting/StatementModal' 
import { useAccounting } from './hooks/useAccounting'

export default function AccountingPage() {
  const {
    loading, isModalOpen, setIsModalOpen,
    regYear, setRegYear, regMonth, setRegMonth, targetDay, setTargetDay, searchTerm, setSearchTerm,
    isRegOpen, setIsRegOpen,
    filteredClients, inventoryMap, inputData, prevData, selectedInventories, showUnregistered, setShowUnregistered,
    isHistOpen, setIsHistOpen, historyList,
    histYear, setHistYear, histMonth, setHistMonth, histTargetDay, setHistTargetDay, histSearchTerm, setHistSearchTerm,
    monthMachineHistory, clients,
    
    handleSearch, handleHistSearch, handleInputChange, toggleInventorySelection, setSelectedInventoriesBulk,
    calculateClientBillFiltered, calculateSelectedTotal, handlePreSave, handleFinalSave,
    handleRebillHistory, handleDeleteHistory, handleDetailRebill, handleDeleteDetail, handleExcludeAsset, 
    togglePaymentStatus, toggleDetailPaymentStatus,
    handleBatchDeleteHistory, handleBatchRebillHistory,

    // ✅ [확인] 여기서 useAccounting 훅으로부터 명세서 관련 기능을 가져옵니다.
    isStatementOpen, selectedSettlementForStatement, myOrg,
    handleOpenStatement, handleCloseStatement
  } = useAccounting()

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>💰 정산 및 회계 관리</h1>
      
      {/* 1. 등록 및 청구 섹션 */}
      <AccountingRegistration 
        isRegOpen={isRegOpen} setIsRegOpen={setIsRegOpen}
        regYear={regYear} setRegYear={setRegYear}
        regMonth={regMonth} setRegMonth={setRegMonth}
        targetDay={targetDay} setTargetDay={setTargetDay}
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        showUnregistered={showUnregistered} setShowUnregistered={setShowUnregistered}
        loading={loading} filteredClients={filteredClients}
        inventoryMap={inventoryMap} inputData={inputData}
        prevData={prevData} selectedInventories={selectedInventories}
        handleInputChange={handleInputChange} toggleInventorySelection={toggleInventorySelection}
        calculateClientBill={calculateClientBillFiltered}
        calculateSelectedTotal={calculateSelectedTotal}
        handlePreSave={handlePreSave}
        onSearch={handleSearch}
        setSelectedInventoriesBulk={setSelectedInventoriesBulk}
        handleExcludeAsset={handleExcludeAsset}
      />

      {/* 2. 청구 이력 및 관리 섹션 */}
      <AccountingHistory 
        isHistOpen={isHistOpen} setIsHistOpen={setIsHistOpen}
        histYear={histYear} setHistYear={setHistYear}
        histMonth={histMonth} setHistMonth={setHistMonth}
        historyList={historyList} 
        handleDeleteHistory={handleDeleteHistory}
        monthMachineHistory={monthMachineHistory} 
        handleDeleteDetail={handleDeleteDetail}   
        handleDetailRebill={handleDetailRebill} 
        handleRebillHistory={handleRebillHistory}
        targetDay={histTargetDay} setTargetDay={setHistTargetDay}
        searchTerm={histSearchTerm} setSearchTerm={setHistSearchTerm}
        onSearch={handleHistSearch}
        togglePaymentStatus={togglePaymentStatus}
        toggleDetailPaymentStatus={toggleDetailPaymentStatus}
        handleBatchDeleteHistory={handleBatchDeleteHistory}
        handleBatchRebillHistory={handleBatchRebillHistory}
        
        // ✅ [필수 수정] 이 부분이 누락되어 에러가 발생했습니다. 꼭 추가해주세요!
        handleOpenStatement={handleOpenStatement}
      />
      
      {/* 3. 최종 확인 모달 */}
      {isModalOpen && (
        <SettlementConfirmModal 
          selectedInventories={selectedInventories} calculateSelectedTotal={calculateSelectedTotal}
          clients={clients} inventoryMap={inventoryMap} calculateClientBill={calculateClientBillFiltered}
          onClose={() => setIsModalOpen(false)} onSave={handleFinalSave}
          loading={loading}
        />
      )}

      {/* ✅ 4. 거래명세서 출력 모달 */}
      {isStatementOpen && selectedSettlementForStatement && (
        <StatementModal 
          settlement={selectedSettlementForStatement}
          supplier={myOrg}
          onClose={handleCloseStatement}
        />
      )}
    </div>
  )
}