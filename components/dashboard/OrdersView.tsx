import type { CSSProperties } from 'react'
import { OrderCard } from '@/components/dashboard/OrderCard'
import type { Customer, CustomerUpdate, Order, WorkLog } from '@/lib/dashboard-types'
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
  deleteCustomerUpdate: (updateId: string) => void
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
  openDeliveryProtocolModal: (orderId: string) => void
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
  updateOrderProgress: (orderId: string, progressPercent: number) => void
  workLogsByOrder: Record<string, WorkLog[]>
  customerUpdatesByOrder: Record<string, CustomerUpdate[]>
  unseenCustomerUpdatesByOrder: Record<string, number>
}

export function OrdersView({
  boxStyle,
  buttonStyle,
  customers,
  dangerButtonStyle,
  deleteOrder,
  deleteCustomerUpdate,
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
  openDeliveryProtocolModal,
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
  updateOrderProgress,
  workLogsByOrder,
  customerUpdatesByOrder,
  unseenCustomerUpdatesByOrder,
}: OrdersViewProps) {
  return (
    <div className="ordersWorkspace">
      <section className="ordersControlPanel" style={{ ...boxStyle }}>
        <div className="ordersControlHeader">
          <div>
            <div className="ordersEyebrow">Pracovný zoznam</div>
            <h2>Aktívne zákazky</h2>
          </div>
          <div className="ordersVisibleBadge">{filteredOrders.length}</div>
        </div>

        <div className="filtersGrid filtersGridOrders">
          <label className="ordersFilterField" style={labelStyle} htmlFor="search-orders">
            Hľadať
            <input
              id="search-orders"
              style={inputStyle}
              placeholder="Názov, zákazník, popis..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="ordersFilterField" style={labelStyle} htmlFor="customer-filter">
            Zákazník
            <select id="customer-filter" style={inputStyle} value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
              <option value="vsetci">Všetci zákazníci</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.nazov}
                </option>
              ))}
            </select>
          </label>

          <label className="ordersFilterField" style={labelStyle} htmlFor="status-filter">
            Stav
            <select id="status-filter" style={inputStyle} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="vsetky">Všetky stavy</option>
              {STATUSY.filter((status) => AKTIVNE_STATUSY.includes(status.value)).map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ordersFilterField" style={labelStyle} htmlFor="sort-by">
            Radenie
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
          </label>
        </div>
      </section>

      <main className="ordersBoard" style={boxStyle}>
        <div className="ordersTableHead" aria-hidden="true">
          <span>Zákazka</span>
          <span>Postup</span>
          <span>Zákazník</span>
          <span>Stav</span>
          <span>Termín</span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="ordersEmptyState">
            <strong>Žiadne zákazky na zobrazenie.</strong>
            <span>Skús upraviť filter alebo vytvoriť novú zákazku.</span>
          </div>
        ) : (
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
                      customerUpdates={customerUpdatesByOrder[order.id] || []}
                      unseenCustomerUpdatesCount={unseenCustomerUpdatesByOrder[order.id] || 0}
                      boxStyle={boxStyle}
                      buttonStyle={buttonStyle}
                      dangerButtonStyle={dangerButtonStyle}
                      greenButtonStyle={greenButtonStyle}
                      inputStyle={inputStyle}
                      labelStyle={labelStyle}
                      deleteOrder={deleteOrder}
                      deleteCustomerUpdate={deleteCustomerUpdate}
                      exportOrderWorkLogs={exportOrderWorkLogs}
                      getCustomerName={getCustomerName}
                      getOrderKilometres={getOrderKilometres}
                      isOverdue={isOverdue}
                      openWorkLogModal={openWorkLogModal}
                      openDeliveryProtocolModal={openDeliveryProtocolModal}
                      startEditOrder={startEditOrder}
                      toggleExpandedOrder={toggleExpandedOrder}
                      togglePinnedOrder={togglePinnedOrder}
                      updateOrderStatus={updateOrderStatus}
                      updateOrderProgress={updateOrderProgress}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
