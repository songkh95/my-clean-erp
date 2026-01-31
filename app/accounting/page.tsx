'use client'

import styles from './accounting.module.css'
import AccountingRegistration from '@/components/accounting/AccountingRegistration'
import AccountingHistory from '@/components/accounting/AccountingHistory'
import SettlementConfirmModal from '@/components/accounting/SettlementConfirmModal'
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
    togglePaymentStatus, toggleDetailPaymentStatus // ✅ 함수 가져오기
  } = useAccounting()

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>💰 정산 및 회계 관리</h1>
      
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
        toggleDetailPaymentStatus={toggleDetailPaymentStatus} // ✅ Props 전달
      />
      
      {isModalOpen && (
        <SettlementConfirmModal 
          selectedInventories={selectedInventories} calculateSelectedTotal={calculateSelectedTotal}
          clients={clients} inventoryMap={inventoryMap} calculateClientBill={calculateClientBillFiltered}
          onClose={() => setIsModalOpen(false)} onSave={handleFinalSave}
          loading={loading}
        />
      )}
    </div>
  )
}