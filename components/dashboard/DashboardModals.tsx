'use client'

import { Modal } from '@/components/dashboard/Modal'
import type { Customer, Employee, WorkLog } from '@/lib/dashboard-types'

type DashboardModalsProps = Record<string, any>

export function DashboardModals(props: DashboardModalsProps) {
  const {
    addCustomer,
    addEmployee,
    addOrder,
    addWorkLog,
    buttonStyle,
    calculateHoursFromTimes,
    closeAddCustomerModal,
    closeAddEmployeeModal,
    closeAddOrderModal,
    closeEditCustomerModal,
    closeEditEmployeeModal,
    closeEditOrderModal,
    closeWorkLogModal,
    currentOrder,
    currentOrderWorkLogs,
    customerId,
    customerMode,
    customers,
    dangerButtonStyle,
    deleteWorkLog,
    editCustomerEmail,
    editCustomerKontakt,
    editCustomerNazov,
    editCustomerTelefon,
    editEmployeeCanDelete,
    editEmployeeEmail,
    editEmployeeName,
    editEmployeeTelefon,
    editOrderCustomerId,
    editOrderNazov,
    editOrderPopis,
    editOrderPrijatieZakazky,
    editOrderTermin,
    editingWorkLogId,
    email,
    employeeCanDelete,
    employeeEmail,
    employeeName,
    employeeTelefon,
    employees,
    exportOrderWorkLogsPdf,
    formatDate,
    formatTimeShort,
    getCustomerName,
    getOrderHours,
    getOrderKilometres,
    greenButtonStyle,
    inputStyle,
    labelStyle,
    kontakt,
    nazov,
    newCustomerEmail,
    newCustomerKontakt,
    newCustomerNazov,
    newCustomerTelefon,
    openAddCustomer,
    openAddEmployee,
    openAddOrder,
    openEditCustomer,
    openEditEmployee,
    openEditOrder,
    openWorkLog,
    orderNazov,
    orderPopis,
    orderPrijatieZakazky,
    orderTermin,
    primaryButtonStyle,
    resetWorkLogForm,
    saveCustomerEdit,
    saveEmployeeEdit,
    saveOrderEdit,
    savingCustomer,
    savingEditCustomer,
    savingEditEmployee,
    savingEditOrder,
    savingEmployee,
    savingOrder,
    savingWorkLog,
    secondaryDarkButtonStyle,
    setCustomerId,
    setCustomerMode,
    setEditCustomerEmail,
    setEditCustomerKontakt,
    setEditCustomerNazov,
    setEditCustomerTelefon,
    setEditEmployeeCanDelete,
    setEditEmployeeEmail,
    setEditEmployeeName,
    setEditEmployeeTelefon,
    setEditOrderCustomerId,
    setEditOrderNazov,
    setEditOrderPopis,
    setEditOrderPrijatieZakazky,
    setEditOrderTermin,
    setEmail,
    setEmployeeCanDelete,
    setEmployeeEmail,
    setEmployeeName,
    setEmployeeTelefon,
    setKontakt,
    setNazov,
    setNewCustomerEmail,
    setNewCustomerKontakt,
    setNewCustomerNazov,
    setNewCustomerTelefon,
    setOrderNazov,
    setOrderPopis,
    setOrderPrijatieZakazky,
    setOrderTermin,
    setTelefon,
    setWorkLogDate,
    setWorkLogEnd,
    setWorkLogHours,
    setWorkLogKm,
    setWorkLogStart,
    setWorkLogText,
    setWorkLogTitle,
    startEditWorkLog,
    STATUSY,
    telefon,
    toggleWorkLogEmployee,
    workLogDate,
    workLogEmployees,
    workLogEnd,
    workLogHours,
    workLogKm,
    workLogStart,
    workLogText,
    workLogTitle,
    workLogsByOrder,
  } = props

  return (
    <>
        <Modal open={openAddCustomer} title="Pridať zákazníka" onClose={closeAddCustomerModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void addCustomer()
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="add-customer-name">
                  Názov firmy alebo meno
                </label>
                <input
                  id="add-customer-name"
                  style={inputStyle}
                  placeholder="Názov firmy alebo meno"
                  value={nazov}
                  onChange={(e) => setNazov(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="add-customer-contact">
                  Kontaktná osoba
                </label>
                <input
                  id="add-customer-contact"
                  style={inputStyle}
                  placeholder="Kontaktná osoba"
                  value={kontakt}
                  onChange={(e) => setKontakt(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="add-customer-phone">
                  Telefón
                </label>
                <input
                  id="add-customer-phone"
                  type="tel"
                  style={inputStyle}
                  placeholder="Telefón"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="add-customer-email">
                  Email
                </label>
                <input
                  id="add-customer-email"
                  type="email"
                  style={inputStyle}
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={savingCustomer}>
                  {savingCustomer ? 'Ukladám...' : 'Uložiť zákazníka'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={closeAddCustomerModal}>
                  Zrušiť
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <Modal open={openAddOrder} title="Pridať zákazku" onClose={closeAddOrderModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void addOrder()
            }}
          >
            <div className="modalGrid">
              <div>
                <label style={labelStyle} htmlFor="add-order-name">
                  Názov zákazky
                </label>
                <input
                  id="add-order-name"
                  style={inputStyle}
                  placeholder="Názov zákazky"
                  value={orderNazov}
                  onChange={(e) => setOrderNazov(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="customer-mode">
                  Zákazník
                </label>
                <select
                  id="customer-mode"
                  style={inputStyle}
                  value={customerMode}
                  onChange={(e) => setCustomerMode(e.target.value as 'existing' | 'new')}
                >
                  <option value="existing">Vybrať existujúceho zákazníka</option>
                  <option value="new">Vytvoriť nového zákazníka</option>
                </select>
              </div>

              {customerMode === 'existing' ? (
                <div>
                  <label style={labelStyle} htmlFor="existing-customer">
                    Existujúci zákazník
                  </label>
                  <select id="existing-customer" style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Vyber zákazníka</option>
                    {customers.map((c: Customer) => (
                      <option key={c.id} value={c.id}>
                        {c.nazov}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={labelStyle} htmlFor="new-customer-name">
                    Názov firmy alebo meno osoby
                  </label>
                  <input
                    id="new-customer-name"
                    style={inputStyle}
                    placeholder="Názov firmy alebo meno osoby"
                    value={newCustomerNazov}
                    onChange={(e) => setNewCustomerNazov(e.target.value)}
                  />
                </div>
              )}

              {customerMode === 'new' && (
                <>
                  <div>
                    <label style={labelStyle} htmlFor="new-customer-contact">
                      Kontaktná osoba
                    </label>
                    <input
                      id="new-customer-contact"
                      style={inputStyle}
                      placeholder="Kontaktná osoba"
                      value={newCustomerKontakt}
                      onChange={(e) => setNewCustomerKontakt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="new-customer-phone">
                      Telefón
                    </label>
                    <input
                      id="new-customer-phone"
                      type="tel"
                      style={inputStyle}
                      placeholder="Telefón"
                      value={newCustomerTelefon}
                      onChange={(e) => setNewCustomerTelefon(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="new-customer-email">
                      Email
                    </label>
                    <input
                      id="new-customer-email"
                      type="email"
                      style={inputStyle}
                      placeholder="Email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={labelStyle} htmlFor="order-accepted-date">
                  Prijatie zákazky
                </label>
                <input
                  id="order-accepted-date"
                  style={inputStyle}
                  type="date"
                  value={orderPrijatieZakazky}
                  onChange={(e) => setOrderPrijatieZakazky(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="order-date">
                  Termín
                </label>
                <input
                  id="order-date"
                  style={inputStyle}
                  type="date"
                  value={orderTermin}
                  onChange={(e) => setOrderTermin(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="order-description">
                  Popis
                </label>
                <input
                  id="order-description"
                  style={inputStyle}
                  placeholder="Popis"
                  value={orderPopis}
                  onChange={(e) => setOrderPopis(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button type="submit" style={primaryButtonStyle} disabled={savingOrder}>
                {savingOrder ? 'Ukladám...' : 'Uložiť zákazku'}
              </button>
              <button type="button" style={secondaryDarkButtonStyle} onClick={closeAddOrderModal}>
                Zrušiť
              </button>
            </div>
          </form>
        </Modal>

        <Modal open={openEditCustomer} title="Upraviť zákazníka" onClose={closeEditCustomerModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void saveCustomerEdit()
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="edit-customer-name">
                  Názov firmy
                </label>
                <input
                  id="edit-customer-name"
                  style={inputStyle}
                  value={editCustomerNazov}
                  onChange={(e) => setEditCustomerNazov(e.target.value)}
                  placeholder="Názov firmy"
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="edit-customer-contact">
                  Kontaktná osoba
                </label>
                <input
                  id="edit-customer-contact"
                  style={inputStyle}
                  value={editCustomerKontakt}
                  onChange={(e) => setEditCustomerKontakt(e.target.value)}
                  placeholder="Kontaktná osoba"
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="edit-customer-phone">
                  Telefón
                </label>
                <input
                  id="edit-customer-phone"
                  type="tel"
                  style={inputStyle}
                  value={editCustomerTelefon}
                  onChange={(e) => setEditCustomerTelefon(e.target.value)}
                  placeholder="Telefón"
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="edit-customer-email">
                  Email
                </label>
                <input
                  id="edit-customer-email"
                  type="email"
                  style={inputStyle}
                  value={editCustomerEmail}
                  onChange={(e) => setEditCustomerEmail(e.target.value)}
                  placeholder="Email"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={savingEditCustomer}>
                  {savingEditCustomer ? 'Ukladám...' : 'Uložiť zmeny'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={closeEditCustomerModal}>
                  Zrušiť
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <Modal open={openEditOrder} title="Upraviť zákazku" onClose={closeEditOrderModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void saveOrderEdit()
            }}
          >
            <div className="modalGrid">
              <div>
                <label style={labelStyle} htmlFor="edit-order-name">
                  Názov zákazky
                </label>
                <input
                  id="edit-order-name"
                  style={inputStyle}
                  placeholder="Názov zákazky"
                  value={editOrderNazov}
                  onChange={(e) => setEditOrderNazov(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="edit-order-customer">
                  Zákazník
                </label>
                <select
                  id="edit-order-customer"
                  style={inputStyle}
                  value={editOrderCustomerId}
                  onChange={(e) => setEditOrderCustomerId(e.target.value)}
                >
                  <option value="">Vyber zákazníka</option>
                  {customers.map((c: Customer) => (
                    <option key={c.id} value={c.id}>
                      {c.nazov}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="edit-order-accepted-date">
                  Prijatie zákazky
                </label>
                <input
                  id="edit-order-accepted-date"
                  style={inputStyle}
                  type="date"
                  value={editOrderPrijatieZakazky}
                  onChange={(e) => setEditOrderPrijatieZakazky(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="edit-order-date">
                  Termín
                </label>
                <input
                  id="edit-order-date"
                  style={inputStyle}
                  type="date"
                  value={editOrderTermin}
                  onChange={(e) => setEditOrderTermin(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="edit-order-description">
                  Popis
                </label>
                <input
                  id="edit-order-description"
                  style={inputStyle}
                  placeholder="Popis"
                  value={editOrderPopis}
                  onChange={(e) => setEditOrderPopis(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button type="submit" style={primaryButtonStyle} disabled={savingEditOrder}>
                {savingEditOrder ? 'Ukladám...' : 'Uložiť zmeny'}
              </button>
              <button type="button" style={secondaryDarkButtonStyle} onClick={closeEditOrderModal}>
                Zrušiť
              </button>
            </div>
          </form>
        </Modal>

        <Modal open={openAddEmployee} title="Pridať zamestnanca" onClose={closeAddEmployeeModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void addEmployee()
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="employee-name">
                  Meno
                </label>
                <input
                  id="employee-name"
                  style={inputStyle}
                  placeholder="Meno zamestnanca"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="employee-phone">
                  Telefón
                </label>
                <input
                  id="employee-phone"
                  style={inputStyle}
                  placeholder="Telefón"
                  value={employeeTelefon}
                  onChange={(e) => setEmployeeTelefon(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="employee-email">
                  Email
                </label>
                <input
                  id="employee-email"
                  type="email"
                  style={inputStyle}
                  placeholder="Email"
                  value={employeeEmail}
                  onChange={(e) => setEmployeeEmail(e.target.value)}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={employeeCanDelete}
                  onChange={(e) => setEmployeeCanDelete(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Môže mazať</span>
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={savingEmployee}>
                  {savingEmployee ? 'Ukladám...' : 'Uložiť zamestnanca'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={closeAddEmployeeModal}>
                  Zrušiť
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <Modal open={openEditEmployee} title="Upraviť zamestnanca" onClose={closeEditEmployeeModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void saveEmployeeEdit()
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="edit-employee-name">
                  Meno
                </label>
                <input
                  id="edit-employee-name"
                  style={inputStyle}
                  placeholder="Meno zamestnanca"
                  value={editEmployeeName}
                  onChange={(e) => setEditEmployeeName(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="edit-employee-phone">
                  Telefón
                </label>
                <input
                  id="edit-employee-phone"
                  style={inputStyle}
                  placeholder="Telefón"
                  value={editEmployeeTelefon}
                  onChange={(e) => setEditEmployeeTelefon(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="edit-employee-email">
                  Email
                </label>
                <input
                  id="edit-employee-email"
                  type="email"
                  style={inputStyle}
                  placeholder="Email"
                  value={editEmployeeEmail}
                  onChange={(e) => setEditEmployeeEmail(e.target.value)}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={editEmployeeCanDelete}
                  onChange={(e) => setEditEmployeeCanDelete(e.target.checked)}
                />
                <span style={{ fontWeight: 700 }}>Môže mazať</span>
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={savingEditEmployee}>
                  {savingEditEmployee ? 'Ukladám...' : 'Uložiť zmeny'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={closeEditEmployeeModal}>
                  Zrušiť
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <Modal
          open={openWorkLog}
          title={currentOrder ? `Výkaz / poznámka: ${currentOrder.nazov}` : 'Výkaz / poznámka'}
          onClose={closeWorkLogModal}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {currentOrder && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 800 }}>{currentOrder.nazov}</div>
                <div style={{ color: '#475569', marginTop: 6 }}>
                  {getCustomerName(currentOrder.customer_id)}
                </div>
                <div style={{ color: '#475569', marginTop: 6 }}>
                  Prijatie: {formatDate(currentOrder.prijatie_zakazky)} | Termín: {formatDate(currentOrder.termin)}
                </div>
                <div style={{ marginTop: 8, fontWeight: 800, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span>Hodiny spolu: {getOrderHours(currentOrder.id).toFixed(1)} h</span>
                  <span>Kilometre spolu: {getOrderKilometres(currentOrder.id).toFixed(0)} km</span>
                  <span>Počet zásahov: {(workLogsByOrder[currentOrder.id] || []).length}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {currentOrder && (
                <>
                  <button type="button" style={buttonStyle} onClick={() => exportOrderWorkLogsPdf(currentOrder.id)}>
                    Export PDF
                  </button>
                </>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void addWorkLog()
              }}
            >
              <div className="workLogGrid">
                <div>
                  <label style={labelStyle} htmlFor="worklog-date">
                    Dátum
                  </label>
                  <input
                    id="worklog-date"
                    type="date"
                    style={inputStyle}
                    value={workLogDate}
                    onChange={(e) => setWorkLogDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="worklog-title">
                    Názov zápisu
                  </label>
                  <input
                    id="worklog-title"
                    type="text"
                    style={inputStyle}
                    placeholder="Napr. Vzdialená konfigurácia alebo poznámka"
                    value={workLogTitle}
                    onChange={(e) => setWorkLogTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="worklog-start">
                    Od
                  </label>
                  <input
                    id="worklog-start"
                    type="datetime-local"
                    style={inputStyle}
                    value={workLogStart}
                    onChange={(e) => {
                      const value = e.target.value
                      setWorkLogStart(value)
                      const dateOnly = value.slice(0, 10)
                      if (dateOnly) setWorkLogDate(dateOnly)
                      if (value && workLogEnd) {
                        const calculated = calculateHoursFromTimes(value, workLogEnd)
                        if (Number.isFinite(calculated) && calculated > 0) {
                          setWorkLogHours(calculated.toFixed(2))
                        }
                      }
                    }}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="worklog-end">
                    Do
                  </label>
                  <input
                    id="worklog-end"
                    type="datetime-local"
                    style={inputStyle}
                    value={workLogEnd}
                    onChange={(e) => {
                      const value = e.target.value
                      setWorkLogEnd(value)
                      const dateOnly = value.slice(0, 10)
                      if (dateOnly && !workLogDate) setWorkLogDate(dateOnly)
                      if (workLogStart && value) {
                        const calculated = calculateHoursFromTimes(workLogStart, value)
                        if (Number.isFinite(calculated) && calculated > 0) {
                          setWorkLogHours(calculated.toFixed(2))
                        }
                      }
                    }}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="worklog-hours">
                    Čas / hodiny
                  </label>
                  <input
                    id="worklog-hours"
                    type="text"
                    inputMode="decimal"
                    style={inputStyle}
                    placeholder="Auto z času od-do alebo ručne"
                    value={workLogHours}
                    onChange={(e) => setWorkLogHours(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="worklog-km">
                    Kilometre
                  </label>
                  <input
                    id="worklog-km"
                    type="text"
                    inputMode="decimal"
                    style={inputStyle}
                    placeholder="Napr. 25"
                    value={workLogKm}
                    onChange={(e) => setWorkLogKm(e.target.value)}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle} htmlFor="worklog-text">
                    Popis práce alebo poznámka
                  </label>
                  <textarea
                    id="worklog-text"
                    style={{
                      ...inputStyle,
                      minHeight: 110,
                      resize: 'vertical',
                      fontFamily: 'Arial, Helvetica, sans-serif',
                    }}
                    placeholder="Popíš čo sa robilo, čo treba doriešiť alebo poznámku k zákazke..."
                    value={workLogText}
                    onChange={(e) => setWorkLogText(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button type="submit" style={primaryButtonStyle} disabled={savingWorkLog}>
                  {savingWorkLog ? 'Ukladám...' : editingWorkLogId ? 'Uložiť úpravu zápisu' : 'Uložiť zápis'}
                </button>
                <button type="button" style={secondaryDarkButtonStyle} onClick={resetWorkLogForm}>
                  {editingWorkLogId ? 'Zrušiť úpravu' : 'Vyčistiť formulár'}
                </button>
              </div>
            </form>

            <div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Doterajšie výkazy a poznámky</div>

              {currentOrderWorkLogs.length === 0 ? (
                <div
                  style={{
                    border: '1px dashed #cbd5e1',
                    borderRadius: 12,
                    padding: 14,
                    color: '#64748b',
                    background: '#f8fafc',
                  }}
                >
                  Zatiaľ nie je pridaný žiadny výkaz ani poznámka.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {currentOrderWorkLogs.map((log: WorkLog) => (
                    <div
                      key={log.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 16,
                        padding: 14,
                        background: '#fff',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>
                            {log.nazov_vykazu || 'Bez názvu výkazu'}
                          </div>
                          <div style={{ marginTop: 4, color: '#475569', fontSize: 13 }}>
                            {formatDate(log.datum)} · {formatTimeShort(log.start_time)} – {formatTimeShort(log.end_time)} · {Number(log.hodiny || 0).toFixed(2)} h · {Number(log.kilometre || 0).toFixed(0)} km
                          </div>
                          <div style={{ marginTop: 6, color: '#334155', whiteSpace: 'pre-wrap' }}>
                            {log.praca_popis}
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                            {(log.zamestnanci || []).length > 0 ? (
                              (log.zamestnanci || []).map((name: string) => (
                                <span
                                  key={`${log.id}-${name}`}
                                  style={{
                                    background: '#eef2ff',
                                    color: '#3730a3',
                                    border: '1px solid #c7d2fe',
                                    borderRadius: 999,
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  {name}
                                </span>
                              ))
                            ) : (
                              <span
                                style={{
                                  background: '#f8fafc',
                                  color: '#475569',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 999,
                                  padding: '4px 10px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                Bez zamestnancov
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" style={buttonStyle} onClick={() => startEditWorkLog(log)}>
                            Upraviť
                          </button>
                          <button type="button" style={dangerButtonStyle} onClick={() => deleteWorkLog(log.id)}>
                            Zmazať
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
    </>
  )
}

