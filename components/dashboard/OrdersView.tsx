import type { CSSProperties } from 'react'
import { OrderCard } from '@/components/dashboard/OrderCard'
import type { Customer, Order, WorkLog } from '@/lib/dashboard-types'
import { AKTIVNE_STATUSY, STATUSY } from '@/lib/dashboard-utils'

type OrderSection = {
  key: string
  title: string
  description: string
  items: Order[]
}

type OrdersViewProps = {
  boxStyle: CSSProperties
  buttonStyle: CSSProperties
  customers: Customer[]
  dangerButtonStyle: CSSProperties
  deleteOrder: (orderId: string) => void
  expandedOrderIds: string[]
  exportOrderWorkLogs: (orderId: string) => void
  filteredOrders: Order[]
  getCustomerName: (customerId: string) => string
  getOrderKilometres: (orderId: string) => number
  greenButtonStyle: CSSProperties
  groupedOrders: OrderSection[]
  inputStyle: CSSProperties
  isOverdue: (order: Order) => boolean
  isPinnedOrder: (orderId: string) => boolean
  labelStyle: CSSProperties
  openWorkLogModal: (orderId: string) => void
  search: string
  selectedCustomerId: string
  setSearch: (value: string) => void
  setSelectedCustomerId: (value: string) => void
  setSortBy: (value: string) => void
  setStatusFilter: (value: string) => void
  sortBy: string
  startEditOrder: (order: Order) => void
  statusFilter: string
  toggleExpandedOrder: (orderId: string) => void
  togglePinnedOrder: (orderId: string) => void
  updateOrderStatus: (orderId: string, status: string) => void
  workLogsByOrder: Record<string, WorkLog[]>
}

export function OrdersView({
  boxStyle,
  buttonStyle,
  customers,
  dangerButtonStyle,
  deleteOrder,
  expandedOrderIds,
  exportOrderWorkLogs,
  filteredOrders,
  getCustomerName,
  getOrderKilometres,
  greenButtonStyle,
  groupedOrders,
  inputStyle,
  isOverdue,
  isPinnedOrder,
  labelStyle,
  openWorkLogModal,
  search,
  selectedCustomerId,
  setSearch,
  setSelectedCustomerId,
  setSortBy,
  setStatusFilter,
  sortBy,
  startEditOrder,
  statusFilter,
  toggleExpandedOrder,
  togglePinnedOrder,
  updateOrderStatus,
  workLogsByOrder,
}: OrdersViewProps) {
  return (
    <>
      <div className="ordersControlPanel" style={{ ...boxStyle, marginBottom: 12, padding: 16 }}>
        <div className="ordersControlHeader">
          <div>
            <div className="ordersEyebrow">Pracovný zoznam</div>
            <h2>Aktívne zákazky</h2>
            <p>Rýchlo nájdi zákazku, pozri stav a otvor výkaz alebo poznámku.</p>
          </div>
          <div className="ordersVisibleBadge">{filteredOrders.length} zobrazených</div>
        </div>

        <div className="filtersGrid filtersGridOrders">
          <div>
            <label style={labelStyle} htmlFor="search-orders">
              Hľadať
            </label>
            <input
              id="search-orders"
              style={inputStyle}
              placeholder="Názov zákazky, zákazník, popis, zamestnanec..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="customer-filter">
              Zákazník
            </label>
            <select id="customer-filter" style={inputStyle} value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
              <option value="vsetci">Všetci zákazníci</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.nazov}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="status-filter">
              Filter
            </label>
            <select id="status-filter" style={inputStyle} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="vsetky">Všetky stavy</option>
              {STATUSY.filter((status) => AKTIVNE_STATUSY.includes(status.value)).map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="sort-by">
              Radenie
            </label>
            <select id="sort-by" style={inputStyle} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="newest">Najnovšie</option>
              <option value="oldest">Najstaršie</option>
              <option value="deadline">Termín - od najbližších</option>
              <option value="deadline_desc">Termín - od najvzdialenejších</option>
              <option value="customer">Podľa zákazníka</option>
              <option value="status">Podľa stavu</option>
              <option value="name">Podľa názvu</option>
              <option value="accepted">Prijatie - od najstarších</option>
              <option value="accepted_desc">Prijatie - od najnovších</option>
            </select>
          </div>
        </div>
      </div>

      <div className="ordersBoard" style={boxStyle}>
        {filteredOrders.length === 0 && (
          <div className="ordersEmptyState">
            <strong>Žiadne zákazky na zobrazenie.</strong>
            <span>Skús upraviť filter alebo vytvoriť novú zákazku.</span>
          </div>
        )}

        <div className="ordersSectionStack">
          {groupedOrders.map((section) => (
            <section className={`ordersSection ordersSection-${section.key}`} key={section.key}>
              <div className="ordersSectionHeader">
                <div>
                  <h3>{section.title}</h3>
                  <p>{section.description}</p>
                </div>
                <div className="ordersSectionCount">{section.items.length}</div>
              </div>

              <div className="ordersCardsStack">
                {section.items.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    expanded={expandedOrderIds.includes(order.id)}
                    isPinned={isPinnedOrder(order.id)}
                    orderLogs={workLogsByOrder[order.id] || []}
                    boxStyle={boxStyle}
                    buttonStyle={buttonStyle}
                    dangerButtonStyle={dangerButtonStyle}
                    greenButtonStyle={greenButtonStyle}
                    inputStyle={inputStyle}
                    labelStyle={labelStyle}
                    deleteOrder={deleteOrder}
                    exportOrderWorkLogs={exportOrderWorkLogs}
                    getCustomerName={getCustomerName}
                    getOrderKilometres={getOrderKilometres}
                    isOverdue={isOverdue}
                    openWorkLogModal={openWorkLogModal}
                    startEditOrder={startEditOrder}
                    toggleExpandedOrder={toggleExpandedOrder}
                    togglePinnedOrder={togglePinnedOrder}
                    updateOrderStatus={updateOrderStatus}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
