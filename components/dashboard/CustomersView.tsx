import type { CSSProperties } from 'react'
import type { Customer } from '@/lib/dashboard-types'

type CustomersViewProps = {
  customers: Customer[]
  boxStyle: CSSProperties
  buttonStyle: CSSProperties
  dangerButtonStyle: CSSProperties
  deleteCustomer: (customerId: string) => void
  startEditCustomer: (customer: Customer) => void
}

export function CustomersView({
  customers,
  boxStyle,
  buttonStyle,
  dangerButtonStyle,
  deleteCustomer,
  startEditCustomer,
}: CustomersViewProps) {
  return (
    <div style={boxStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16 }}>Zoznam zákazníkov</div>
        <div style={{ color: '#475569', fontWeight: 700 }}>Spolu: {customers.length}</div>
      </div>

      <div className="desktopTable">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 10px' }}>Názov</th>
                <th style={{ padding: '12px 10px' }}>Kontakt</th>
                <th style={{ padding: '12px 10px' }}>Telefón</th>
                <th style={{ padding: '12px 10px' }}>Email</th>
                <th style={{ padding: '12px 10px' }}>Akcie</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 10px', fontWeight: 800 }}>{customer.nazov}</td>
                  <td style={{ padding: '12px 10px' }}>{customer.kontakt || '-'}</td>
                  <td style={{ padding: '12px 10px' }}>{customer.telefon || '-'}</td>
                  <td style={{ padding: '12px 10px' }}>{customer.email || '-'}</td>

                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" style={buttonStyle} onClick={() => startEditCustomer(customer)}>
                        Upraviť
                      </button>
                      <button type="button" style={dangerButtonStyle} onClick={() => deleteCustomer(customer.id)}>
                        Zmazať
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                    Zatiaľ nemáš žiadnych zákazníkov
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mobileCards">
        {customers.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>Zatiaľ nemáš žiadnych zákazníkov</div>}

        {customers.map((customer) => (
          <div
            key={customer.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              background: '#fff',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 15 }}>{customer.nazov}</div>

            <div style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 13 }}>
              <div>
                <strong>Kontakt:</strong> {customer.kontakt || '-'}
              </div>
              <div>
                <strong>Telefón:</strong> {customer.telefon || '-'}
              </div>
              <div>
                <strong>Email:</strong> {customer.email || '-'}
              </div>

            </div>

            <div className="mobileActionRow" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <button type="button" style={buttonStyle} onClick={() => startEditCustomer(customer)}>
                Upraviť
              </button>
              <button type="button" style={dangerButtonStyle} onClick={() => deleteCustomer(customer.id)}>
                Zmazať
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
