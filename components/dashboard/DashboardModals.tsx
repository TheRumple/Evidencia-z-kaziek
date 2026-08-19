'use client'

import { Modal } from '@/components/dashboard/Modal'
import type { Customer, Employee, WorkLog } from '@/lib/dashboard-types'
import { useRef } from 'react'
import type { PointerEvent } from 'react'

type DashboardModalsProps = Record<string, any>

function SignaturePad({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)

  function getPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    drawingRef.current = true
    canvas.setPointerCapture(event.pointerId)
    const point = getPoint(event)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const point = getPoint(event)
    ctx.lineTo(point.x, point.y)
    ctx.strokeStyle = '#020617'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    onChange(canvas.toDataURL('image/png'))
  }

  function stopDrawing(event: PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false
    canvasRef.current?.releasePointerCapture(event.pointerId)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: '#0f172a', fontWeight: 900 }}>{label}</div>
        <button
          type="button"
          onClick={clearSignature}
          disabled={!value}
          style={{
            border: '1px solid #cbd5e1',
            background: '#fff',
            borderRadius: 10,
            color: '#334155',
            cursor: value ? 'pointer' : 'default',
            fontWeight: 900,
            opacity: value ? 1 : 0.45,
            padding: '7px 10px',
          }}
        >
          Vymazať
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={520}
        height={150}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        style={{
          background: '#fff',
          border: '1px dashed #94a3b8',
          borderRadius: 14,
          cursor: 'crosshair',
          height: 130,
          touchAction: 'none',
          width: '100%',
        }}
      />
    </div>
  )
}

const INSPECTION_TEMPLATES = [
  {
    label: 'Kamery',
    title: 'Obhliadka - kamerový systém',
    text: `Typ obhliadky: Kamerový systém

Checklist:
[ ] počet kamier:
[ ] NVR / záznamník:
[ ] miesto záznamníka:
[ ] internet dostupný:
[ ] napájanie dostupné:
[ ] existujúca kabeláž:
[ ] treba ťahať novú kabeláž:
[ ] montážna výška:
[ ] prístup rebrík / plošina:
[ ] požadované zóny záberu:
[ ] fotky z miesta:

Poznámka:
`,
  },
  {
    label: 'EZS alarm',
    title: 'Obhliadka - EZS alarm',
    text: `Typ obhliadky: EZS alarm

Checklist:
[ ] ústredňa / miesto ústredne:
[ ] počet zón:
[ ] vstupné dvere:
[ ] pohybové senzory:
[ ] magnetické kontakty:
[ ] siréna vnútorná / vonkajšia:
[ ] GSM / internet komunikácia:
[ ] ovládanie klávesnica / aplikácia:
[ ] existujúca kabeláž:
[ ] treba ťahať novú kabeláž:
[ ] fotky z miesta:

Poznámka:
`,
  },
  {
    label: 'Loxone',
    title: 'Obhliadka - Loxone / smart home',
    text: `Typ obhliadky: Loxone / smart home

Checklist:
[ ] Miniserver / rozvádzač:
[ ] ovládané svetlá:
[ ] tienenie:
[ ] kúrenie / chladenie:
[ ] meranie energií:
[ ] prístup do siete:
[ ] existujúca dokumentácia:
[ ] požiadavky zákazníka:
[ ] možnosti kabeláže:
[ ] fotky rozvádzača:

Poznámka:
`,
  },
  {
    label: 'Sieť / Wi-Fi',
    title: 'Obhliadka - sieť / Wi-Fi / LAN',
    text: `Typ obhliadky: Sieť / Wi-Fi / LAN

Checklist:
[ ] internetový prívod:
[ ] router:
[ ] switch:
[ ] počet dátových zásuviek:
[ ] Wi-Fi pokrytie:
[ ] problémové miesta:
[ ] rack / miesto technológie:
[ ] existujúca kabeláž:
[ ] treba ťahať novú kabeláž:
[ ] fotky z miesta:

Poznámka:
`,
  },
  {
    label: 'Elektro',
    title: 'Obhliadka - elektro / rozvádzač',
    text: `Typ obhliadky: Elektro / rozvádzač

Checklist:
[ ] hlavný rozvádzač:
[ ] podružný rozvádzač:
[ ] ističe / chrániče:
[ ] prívod:
[ ] miesto montáže:
[ ] potrebné vypnutie:
[ ] prístup k rozvádzaču:
[ ] dokumentácia:
[ ] fotky rozvádzača:

Poznámka:
`,
  },
  {
    label: 'Všeobecná',
    title: 'Obhliadka - všeobecná',
    text: `Typ obhliadky: Všeobecná

Checklist:
[ ] čo zákazník potrebuje vyriešiť:
[ ] miesto realizácie:
[ ] existujúci stav:
[ ] potrebný materiál:
[ ] prístup na miesto:
[ ] termínová požiadavka:
[ ] čo treba preveriť:
[ ] fotky z miesta:

Poznámka:
`,
  },
]

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
    closeDeliveryProtocolModal,
    closeWorkLogModal,
    currentOrder,
    currentOrderWorkLogs,
    customerId,
    customerMode,
    customers,
    dangerButtonStyle,
    deleteWorkLog,
    deliveryProtocolId,
    deliveryProtocolCustomer,
    deliveryProtocolCustomerId,
    deliveryProtocolDate,
    deliveryProtocolDeliveredBy,
    deliveryProtocolItems,
    deliveryProtocolNumber,
    deliveryProtocols,
    deliveryProtocolReceivedBy,
    deliveryProtocolTested,
    deliveryProtocolBriefed,
    deliveryProtocolReceivedSignature,
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
    editOrderPublicMessage,
    editOrderPrijatieZakazky,
    editOrderRequester,
    editOrderRequesterEmail,
    editOrderTermin,
    editingWorkLogId,
    email,
    employeeCanDelete,
    employeeEmail,
    employeeName,
    employeeTelefon,
    employees,
    exportDeliveryProtocolPdf,
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
    openDeliveryProtocol,
    openEditCustomer,
    openEditEmployee,
    openEditOrder,
    openWorkLog,
    orderNazov,
    orderPopis,
    orderPublicMessage,
    orderPrijatieZakazky,
    orderRequester,
    orderRequesterEmail,
    orderTermin,
    primaryButtonStyle,
    resetWorkLogForm,
    saveCustomerEdit,
    saveDeliveryProtocol,
    saveEmployeeEdit,
    saveOrderEdit,
    savingCustomer,
    savingEditCustomer,
    savingEditEmployee,
    savingEditOrder,
    savingEmployee,
    savingDeliveryProtocol,
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
    setEditOrderPublicMessage,
    setEditOrderPrijatieZakazky,
    setEditOrderRequester,
    setEditOrderRequesterEmail,
    setEditOrderTermin,
    setEmail,
    setEmployeeCanDelete,
    setEmployeeEmail,
    setEmployeeName,
    setEmployeeTelefon,
    selectDeliveryProtocolCustomer,
    setDeliveryProtocolCustomer,
    setDeliveryProtocolDate,
    setDeliveryProtocolDeliveredBy,
    setDeliveryProtocolNumber,
    setDeliveryProtocolReceivedBy,
    setDeliveryProtocolTested,
    setDeliveryProtocolBriefed,
    setDeliveryProtocolReceivedSignature,
    setKontakt,
    setNazov,
    setNewCustomerEmail,
    setNewCustomerKontakt,
    setNewCustomerNazov,
    setNewCustomerTelefon,
    setOrderNazov,
    setOrderPopis,
    setOrderPublicMessage,
    setOrderPrijatieZakazky,
    setOrderRequester,
    setOrderRequesterEmail,
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
    addDeliveryProtocolItem,
    removeDeliveryProtocolItem,
    openSavedDeliveryProtocol,
    toggleWorkLogEmployee,
    updateDeliveryProtocolItem,
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

  function applyInspectionTemplate(template: (typeof INSPECTION_TEMPLATES)[number]) {
    setWorkLogTitle(template.title)
    setWorkLogText(template.text)
    if (!workLogHours) setWorkLogHours('0.5')
    if (!workLogKm) setWorkLogKm('0')
  }

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
                <label style={labelStyle} htmlFor="order-requester">
                  Žiadateľ
                </label>
                <input
                  id="order-requester"
                  style={inputStyle}
                  placeholder="Meno osoby, ktorá zákazku objednala"
                  value={orderRequester}
                  onChange={(e) => setOrderRequester(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="order-requester-email">
                  Email žiadateľa
                </label>
                <input
                  id="order-requester-email"
                  type="email"
                  style={inputStyle}
                  value={orderRequesterEmail}
                  onChange={(e) => setOrderRequesterEmail(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="order-description">
                  Popis
                </label>
                <textarea
                  id="order-description"
                  rows={4}
                  style={{ ...inputStyle, minHeight: 110, resize: 'vertical', lineHeight: 1.45, fontFamily: 'inherit' }}
                  placeholder="Popis"
                  value={orderPopis}
                  onChange={(e) => setOrderPopis(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.stopPropagation()
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="order-public-message">
                  Správa pre zákazníka
                </label>
                <textarea
                  id="order-public-message"
                  rows={3}
                  style={{ ...inputStyle, minHeight: 88, resize: 'vertical', lineHeight: 1.45, fontFamily: 'inherit' }}
                  placeholder="Toto uvidí zákazník v časti Moje požiadavky. Napr. čakáme na dodanie materiálu."
                  value={orderPublicMessage}
                  onChange={(e) => setOrderPublicMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.stopPropagation()
                  }}
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
                <label style={labelStyle} htmlFor="edit-order-requester">
                  Žiadateľ
                </label>
                <input
                  id="edit-order-requester"
                  style={inputStyle}
                  placeholder="Meno osoby, ktorá zákazku objednala"
                  value={editOrderRequester}
                  onChange={(e) => setEditOrderRequester(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="edit-order-requester-email">
                  Email žiadateľa
                </label>
                <input
                  id="edit-order-requester-email"
                  type="email"
                  style={inputStyle}
                  value={editOrderRequesterEmail}
                  onChange={(e) => setEditOrderRequesterEmail(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="edit-order-description">
                  Popis
                </label>
                <textarea
                  id="edit-order-description"
                  rows={4}
                  style={{ ...inputStyle, minHeight: 110, resize: 'vertical', lineHeight: 1.45, fontFamily: 'inherit' }}
                  placeholder="Popis"
                  value={editOrderPopis}
                  onChange={(e) => setEditOrderPopis(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.stopPropagation()
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="edit-order-public-message">
                  Správa pre zákazníka
                </label>
                <textarea
                  id="edit-order-public-message"
                  rows={3}
                  style={{ ...inputStyle, minHeight: 88, resize: 'vertical', lineHeight: 1.45, fontFamily: 'inherit' }}
                  placeholder="Toto uvidí zákazník v časti Moje požiadavky."
                  value={editOrderPublicMessage}
                  onChange={(e) => setEditOrderPublicMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.stopPropagation()
                  }}
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
          open={openDeliveryProtocol}
          title="Odovzdávací protokol"
          onClose={closeDeliveryProtocolModal}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: 12,
                color: '#475569',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              Priprav protokol vopred, ulož ho a u zákazníka už len doplň podpis a vytvor PDF.
            </div>

            {deliveryProtocols.length > 0 && (
              <div>
                <label style={labelStyle} htmlFor="delivery-protocol-saved">
                  Pripravené protokoly
                </label>
                <select
                  id="delivery-protocol-saved"
                  style={inputStyle}
                  value={deliveryProtocolId}
                  onChange={(event) => openSavedDeliveryProtocol(event.target.value)}
                >
                  <option value="">Nový protokol</option>
                  {deliveryProtocols.map((protocol: any) => (
                    <option key={protocol.id} value={protocol.id}>
                      {protocol.protocol_number} - {protocol.customer_name || 'Bez zákazníka'} ({formatDate(protocol.protocol_date)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="modalGrid">
              <div>
                <label style={labelStyle} htmlFor="delivery-protocol-number">
                  Číslo protokolu
                </label>
                <input
                  id="delivery-protocol-number"
                  style={inputStyle}
                  value={deliveryProtocolNumber}
                  onChange={(event) => setDeliveryProtocolNumber(event.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="delivery-protocol-date">
                  Dátum odovzdania
                </label>
                <input
                  id="delivery-protocol-date"
                  type="date"
                  style={inputStyle}
                  value={deliveryProtocolDate}
                  onChange={(event) => setDeliveryProtocolDate(event.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="delivery-protocol-customer">
                  Zákazník
                </label>
                <select
                  id="delivery-protocol-customer"
                  style={inputStyle}
                  value={deliveryProtocolCustomerId}
                  onChange={(event) => selectDeliveryProtocolCustomer(event.target.value)}
                >
                  <option value="">Vyber zákazníka</option>
                  {customers.map((customer: Customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.nazov}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="delivery-protocol-delivered-by">
                  Odovzdal
                </label>
                <input
                  id="delivery-protocol-delivered-by"
                  style={inputStyle}
                  placeholder="Meno technika"
                  value={deliveryProtocolDeliveredBy}
                  onChange={(event) => setDeliveryProtocolDeliveredBy(event.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle} htmlFor="delivery-protocol-received-by">
                  Prevzal
                </label>
                <input
                  id="delivery-protocol-received-by"
                  style={inputStyle}
                  placeholder="Meno zákazníka"
                  value={deliveryProtocolReceivedBy}
                  onChange={(event) => setDeliveryProtocolReceivedBy(event.target.value)}
                />
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Odovzdaná technika a príslušenstvo</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {deliveryProtocolItems.map((item: any, index: number) => (
                  <div
                    key={item.id}
                    className="deliveryProtocolItemRow"
                    style={{
                      display: 'grid',
                      gap: 7,
                      alignItems: 'end',
                    }}
                  >
                    <div>
                      {index === 0 && <label style={labelStyle}>Zariadenie / položka</label>}
                      <input
                        style={inputStyle}
                        placeholder="Napr. kamera, NVR, klávesnica"
                        value={item.name}
                        onChange={(event) => updateDeliveryProtocolItem(index, 'name', event.target.value)}
                      />
                    </div>
                    <div>
                      {index === 0 && <label style={labelStyle}>Sériové číslo</label>}
                      <input
                        style={inputStyle}
                        placeholder="S/N"
                        value={item.serialNumber}
                        onChange={(event) => updateDeliveryProtocolItem(index, 'serialNumber', event.target.value)}
                      />
                    </div>
                    <div>
                      {index === 0 && <label style={labelStyle}>Ks</label>}
                      <input
                        style={inputStyle}
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(event) => updateDeliveryProtocolItem(index, 'quantity', event.target.value)}
                      />
                    </div>
                    <div>
                      {index === 0 && <label style={labelStyle}>Poznámka</label>}
                      <input
                        style={inputStyle}
                        placeholder="Voliteľné"
                        value={item.note}
                        onChange={(event) => updateDeliveryProtocolItem(index, 'note', event.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDeliveryProtocolItem(index)}
                      disabled={deliveryProtocolItems.length <= 1}
                      style={{
                        ...dangerButtonStyle,
                        minHeight: 40,
                        padding: 0,
                        borderRadius: 10,
                        opacity: deliveryProtocolItems.length <= 1 ? 0.45 : 1,
                      }}
                      aria-label="Zmazať riadok"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                borderRadius: 14,
                padding: 12,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 900 }}>Potvrdenie</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deliveryProtocolTested}
                  onChange={(event) => setDeliveryProtocolTested(event.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span>Zariadenie bolo odskúšané a je funkčné.</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deliveryProtocolBriefed}
                  onChange={(event) => setDeliveryProtocolBriefed(event.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span>Zákazník bol oboznámený so základnou obsluhou.</span>
              </label>
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                borderRadius: 14,
                padding: 12,
                display: 'grid',
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 900 }}>Podpisy do PDF</div>
              <div style={{ maxWidth: 560 }}>
                <SignaturePad
                  label="Podpis prevzal"
                  value={deliveryProtocolReceivedSignature}
                  onChange={setDeliveryProtocolReceivedSignature}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <button type="button" style={buttonStyle} onClick={addDeliveryProtocolItem}>
                + Pridať položku
              </button>
              <button type="button" style={buttonStyle} onClick={saveDeliveryProtocol} disabled={savingDeliveryProtocol}>
                {savingDeliveryProtocol ? 'Ukladám...' : 'Uložiť prípravu'}
              </button>
              <button type="button" style={primaryButtonStyle} onClick={() => exportDeliveryProtocolPdf('show')}>
                Ukáž PDF
              </button>
              <button type="button" style={primaryButtonStyle} onClick={() => exportDeliveryProtocolPdf('mail')}>
                Odoslať mailom
              </button>
              <button type="button" style={secondaryDarkButtonStyle} onClick={closeDeliveryProtocolModal}>
                Zrušiť
              </button>
            </div>
          </div>
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

            <div
              style={{
                border: '1px solid #bbf7d0',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfccb 100%)',
                borderRadius: 14,
                padding: 12,
                display: 'grid',
                gap: 9,
              }}
            >
              <div>
                <div style={{ color: '#14532d', fontWeight: 900, fontSize: 14 }}>Rýchla obhliadka</div>
                <div style={{ color: '#3f6212', fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                  Vyber typ a formulár sa predvyplní bodmi, ktoré len doplníš.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {INSPECTION_TEMPLATES.map((template) => (
                  <button
                    key={template.label}
                    type="button"
                    onClick={() => applyInspectionTemplate(template)}
                    style={{
                      border: '1px solid rgba(101, 163, 13, 0.34)',
                      background: '#fff',
                      color: '#14532d',
                      borderRadius: 999,
                      padding: '7px 10px',
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: 'pointer',
                      boxShadow: '0 5px 12px rgba(22, 101, 52, 0.08)',
                    }}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
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

