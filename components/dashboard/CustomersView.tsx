import type { CSSProperties } from 'react'
import type { Customer, CustomerContact } from '@/lib/dashboard-types'

type CustomersViewProps = {
  customers: Customer[]
  customerContacts: CustomerContact[]
  contactCustomerId: string
  contactEmail: string
  contactName: string
  contactPhone: string
  contactPortalCode: string
  contactRole: 'owner' | 'user'
  boxStyle: CSSProperties
  buttonStyle: CSSProperties
  dangerButtonStyle: CSSProperties
  addCustomerContact: (customerId?: string) => void
  deleteCustomer: (customerId: string) => void
  deleteCustomerContact: (contactId: string) => void
  resetContactForm: (customerId?: string) => void
  savingContact: boolean
  setContactCustomerId: (value: string) => void
  setContactEmail: (value: string) => void
  setContactName: (value: string) => void
  setContactPhone: (value: string) => void
  setContactPortalCode: (value: string) => void
  setContactRole: (value: 'owner' | 'user') => void
  startEditCustomer: (customer: Customer) => void
}

export function CustomersView({
  customers,
  customerContacts,
  contactCustomerId,
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
  setContactCustomerId,
  setContactEmail,
  setContactName,
  setContactPhone,
  setContactPortalCode,
  setContactRole,
  startEditCustomer,
}: CustomersViewProps) {
  function getContactsForCustomer(customerId: string) {
    return customerContacts.filter((contact) => contact.customers?.some((link) => link.customer_id === customerId))
  }

  function getContactRole(contact: CustomerContact, customerId: string) {
    return contact.customers?.find((link) => link.customer_id === customerId)?.role || 'user'
  }

  function renderContactForm(customerId: string) {
    if (contactCustomerId !== customerId) return null

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          addCustomerContact(customerId)
        }}
        style={{
          marginTop: 10,
          border: '1px solid #bbf7d0',
          background: '#f0fdf4',
          borderRadius: 12,
          padding: 10,
          display: 'grid',
          gridTemplateColumns: 'minmax(140px, 1fr) minmax(150px, 1fr) minmax(110px, 0.7fr) 90px 120px auto',
          gap: 8,
          alignItems: 'end',
        }}
        className="customerContactForm"
      >
        <input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Meno kontaktu" style={contactInputStyle} />
        <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="Email" style={contactInputStyle} />
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
    )
  }

  function renderContacts(customer: Customer) {
    const contacts = getContactsForCustomer(customer.id)

    return (
      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: '#475569', fontSize: 12, fontWeight: 900 }}>Kontakty portálu: {contacts.length}</div>
          <button type="button" style={buttonStyle} onClick={() => resetContactForm(customer.id)}>
            + Kontakt
          </button>
        </div>

        {contacts.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {contacts.map((contact) => {
              const role = getContactRole(contact, customer.id)
              return (
                <div key={contact.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 9, background: '#f8fafc', display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>{contact.name}</strong>
                    <span style={{ border: role === 'owner' ? '1px solid #86efac' : '1px solid #bfdbfe', background: role === 'owner' ? '#dcfce7' : '#dbeafe', color: role === 'owner' ? '#166534' : '#1e40af', borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 900 }}>
                      {role === 'owner' ? 'Správca - vidí všetko' : 'Používateľ - iba vlastné'}
                    </span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                    {contact.email || '-'} · {contact.phone || '-'} · PIN: <strong>{contact.portal_code || '-'}</strong>
                  </div>
                  <div>
                    <button type="button" style={dangerButtonStyle} onClick={() => deleteCustomerContact(contact.id)}>
                      Zmazať kontakt
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: 12 }}>Zatiaľ bez samostatných kontaktov. Stále funguje pôvodný firemný PIN.</div>
        )}

        {renderContactForm(customer.id)}
      </div>
    )
  }

  return (
    <div style={boxStyle}>
      <style jsx>{`
        @media (max-width: 900px) {
          .customerContactForm {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
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
                <th style={{ padding: '12px 10px' }}>PIN portálu</th>
                <th style={{ padding: '12px 10px' }}>Kontakty</th>
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
                  <td style={{ padding: '12px 10px', fontWeight: 900 }}>
                    {customer.portal_code || '-'}
                  </td>
                  <td style={{ padding: '12px 10px', minWidth: 280 }}>
                    {renderContacts(customer)}
                  </td>

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
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
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
              <div>
                <strong>PIN portálu:</strong> {customer.portal_code || '-'}
              </div>

            </div>

            {renderContacts(customer)}

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

const contactInputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  padding: '8px 9px',
  fontWeight: 800,
  color: '#0f172a',
  background: '#fff',
}
