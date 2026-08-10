import type { CSSProperties } from 'react'
import type { Customer, CustomerContact } from '@/lib/dashboard-types'

type CustomersViewProps = {
  customers: Customer[]
  customerContacts: CustomerContact[]
  contactCustomerIds: string[]
  contactEmail: string
  contactName: string
  contactPhone: string
  contactPortalCode: string
  contactRole: 'owner' | 'user'
  boxStyle: CSSProperties
  buttonStyle: CSSProperties
  dangerButtonStyle: CSSProperties
  addCustomerContact: (customerIds?: string[]) => void
  deleteCustomer: (customerId: string) => void
  deleteCustomerContact: (contactId: string) => void
  resetContactForm: (customerId?: string) => void
  savingContact: boolean
  setContactCustomerIds: (value: string[]) => void
  setContactEmail: (value: string) => void
  setContactName: (value: string) => void
  setContactPhone: (value: string) => void
  setContactPortalCode: (value: string) => void
  setContactRole: (value: 'owner' | 'user') => void
  startEditCustomer: (customer: Customer) => void
}

const contactInputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  padding: '8px 9px',
  fontWeight: 800,
  color: '#0f172a',
  background: '#fff',
}

export function CustomersView({
  customers,
  customerContacts,
  contactCustomerIds,
  contactEmail,
  contactName,
  contactPhone,
  contactPortalCode,
  contactRole,
  boxStyle,
  buttonStyle,
  dangerButtonStyle,
  addCustomerContact,
  deleteCustomer,
  deleteCustomerContact,
  resetContactForm,
  savingContact,
  setContactCustomerIds,
  setContactEmail,
  setContactName,
  setContactPhone,
  setContactPortalCode,
  setContactRole,
  startEditCustomer,
}: CustomersViewProps) {
  const customerById = Object.fromEntries(customers.map((customer) => [customer.id, customer]))

  function toggleContactCustomer(customerId: string) {
    setContactCustomerIds(
      contactCustomerIds.includes(customerId)
        ? contactCustomerIds.filter((id) => id !== customerId)
        : [...contactCustomerIds, customerId]
    )
  }

  function getRoleLabel(role: string) {
    return role === 'owner' ? 'Správca' : 'Používateľ'
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <style jsx>{`
        @media (max-width: 900px) {
          .portalContactForm {
            grid-template-columns: 1fr !important;
          }

          .portalContactList {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={boxStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#65a30d', fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Portál</div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Kontakty zákazníkov</div>
          </div>
          <div style={{ color: '#475569', fontWeight: 800 }}>Spolu: {customerContacts.length}</div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            addCustomerContact()
          }}
          className="portalContactForm"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(150px, 1fr) minmax(170px, 1fr) minmax(120px, 0.8fr) 90px 130px auto',
            gap: 8,
            alignItems: 'end',
            border: '1px solid #bbf7d0',
            borderRadius: 14,
            padding: 12,
            background: '#f0fdf4',
          }}
        >
          <input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Meno kontaktu *" style={contactInputStyle} />
          <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="Prihlasovací email *" style={contactInputStyle} />
          <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="Telefón" style={contactInputStyle} />
          <input
            value={contactPortalCode}
            onChange={(event) => setContactPortalCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="PIN"
            inputMode="numeric"
            maxLength={4}
            style={contactInputStyle}
          />
          <select value={contactRole} onChange={(event) => setContactRole(event.target.value as 'owner' | 'user')} style={contactInputStyle}>
            <option value="user">Používateľ</option>
            <option value="owner">Správca</option>
          </select>
          <button type="submit" style={buttonStyle} disabled={savingContact}>
            {savingContact ? 'Ukladám...' : 'Pridať'}
          </button>
        </form>

        <div style={{ marginTop: 10, border: '1px solid #e2e8f0', borderRadius: 14, padding: 12, background: '#fff' }}>
          <div style={{ color: '#475569', fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Priradené firmy</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {customers.map((customer) => (
              <label
                key={customer.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  border: contactCustomerIds.includes(customer.id) ? '1px solid #84cc16' : '1px solid #cbd5e1',
                  background: contactCustomerIds.includes(customer.id) ? '#ecfccb' : '#f8fafc',
                  color: '#0f172a',
                  borderRadius: 999,
                  padding: '7px 10px',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={contactCustomerIds.includes(customer.id)} onChange={() => toggleContactCustomer(customer.id)} />
                {customer.nazov}
              </label>
            ))}
          </div>
        </div>

        <div className="portalContactList" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {customerContacts.length === 0 && <div style={{ color: '#64748b', fontWeight: 800 }}>Zatiaľ nemáš vytvorené kontakty portálu.</div>}
          {customerContacts.map((contact) => (
            <div key={contact.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 12, background: '#fff', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{contact.name}</div>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>{contact.email || '-'} · {contact.phone || '-'}</div>
                </div>
                <div style={{ color: '#0f172a', background: '#e2e8f0', borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 900 }}>PIN {contact.portal_code || '-'}</div>
              </div>

              <div style={{ display: 'grid', gap: 5 }}>
                {(contact.customers || []).map((link) => (
                  <div key={link.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 8px', background: '#f8fafc', fontSize: 12, fontWeight: 800 }}>
                    <span>{customerById[link.customer_id]?.nazov || 'Neznáma firma'}</span>
                    <span style={{ color: link.role === 'owner' ? '#166534' : '#1e40af' }}>{getRoleLabel(link.role)}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => {
                    setContactName(contact.name || '')
                    setContactEmail(contact.email || '')
                    setContactPhone(contact.phone || '')
                    setContactPortalCode(contact.portal_code || '')
                    setContactRole((contact.customers?.[0]?.role || 'user') as 'owner' | 'user')
                    setContactCustomerIds((contact.customers || []).map((link) => link.customer_id))
                  }}
                >
                  Kopírovať údaje
                </button>
                <button type="button" style={dangerButtonStyle} onClick={() => deleteCustomerContact(contact.id)}>
                  Zmazať
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={boxStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Zoznam zákazníkov</div>
          <div style={{ color: '#475569', fontWeight: 800 }}>Spolu: {customers.length}</div>
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
                        <button type="button" style={buttonStyle} onClick={() => resetContactForm(customer.id)}>
                          + Kontakt
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
            <div key={customer.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, marginBottom: 12, background: '#fff' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{customer.nazov}</div>

              <div style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 13 }}>
                <div><strong>Kontakt:</strong> {customer.kontakt || '-'}</div>
                <div><strong>Telefón:</strong> {customer.telefon || '-'}</div>
                <div><strong>Email:</strong> {customer.email || '-'}</div>
              </div>

              <div className="mobileActionRow" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <button type="button" style={buttonStyle} onClick={() => startEditCustomer(customer)}>
                  Upraviť
                </button>
                <button type="button" style={dangerButtonStyle} onClick={() => deleteCustomer(customer.id)}>
                  Zmazať
                </button>
                <button type="button" style={buttonStyle} onClick={() => resetContactForm(customer.id)}>
                  + Kontakt
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
