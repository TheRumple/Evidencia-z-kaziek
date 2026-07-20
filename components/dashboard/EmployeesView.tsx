import type { CSSProperties } from 'react'
import type { Employee } from '@/lib/dashboard-types'

type EmployeesViewProps = {
  employees: Employee[]
  boxStyle: CSSProperties
  buttonStyle: CSSProperties
  dangerButtonStyle: CSSProperties
  primaryButtonStyle: CSSProperties
  deleteEmployee: (employeeId: string) => void
  resetEmployeeForm: () => void
  setOpenAddEmployee: (open: boolean) => void
  startEditEmployee: (employee: Employee) => void
}

export function EmployeesView({
  employees,
  boxStyle,
  buttonStyle,
  dangerButtonStyle,
  primaryButtonStyle,
  deleteEmployee,
  resetEmployeeForm,
  setOpenAddEmployee,
  startEditEmployee,
}: EmployeesViewProps) {
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
        <div style={{ fontWeight: 800, fontSize: 16 }}>Zoznam zamestnancov</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: '#475569', fontWeight: 700 }}>Spolu: {employees.length}</div>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => {
              resetEmployeeForm()
              setOpenAddEmployee(true)
            }}
          >
            + Nový zamestnanec
          </button>
        </div>
      </div>

      <div className="desktopTable">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 10px' }}>Meno</th>
                <th style={{ padding: '12px 10px' }}>Telefón</th>
                <th style={{ padding: '12px 10px' }}>Email</th>
                <th style={{ padding: '12px 10px' }}>Mazanie</th>
                <th style={{ padding: '12px 10px' }}>Akcie</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 10px', fontWeight: 800 }}>{employee.name}</td>
                  <td style={{ padding: '12px 10px' }}>{employee.telefon || '-'}</td>
                  <td style={{ padding: '12px 10px' }}>{employee.email || '-'}</td>
                  <td style={{ padding: '12px 10px' }}>{employee.can_delete === false ? 'Zakázané' : 'Povolené'}</td>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" style={buttonStyle} onClick={() => startEditEmployee(employee)}>
                        Upraviť
                      </button>
                      <button type="button" style={dangerButtonStyle} onClick={() => deleteEmployee(employee.id)}>
                        Zmazať
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                    Zatiaľ nemáš žiadnych zamestnancov
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mobileCards">
        {employees.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>Zatiaľ nemáš žiadnych zamestnancov</div>}

        {employees.map((employee) => (
          <div
            key={employee.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              background: '#fff',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 15 }}>{employee.name}</div>

            <div style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 13 }}>
              <div>
                <strong>Telefón:</strong> {employee.telefon || '-'}
              </div>
              <div>
                <strong>Email:</strong> {employee.email || '-'}
              </div>
              <div>
                <strong>Mazanie:</strong> {employee.can_delete === false ? 'Zakázané' : 'Povolené'}
              </div>
            </div>

            <div className="mobileActionRow" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <button type="button" style={buttonStyle} onClick={() => startEditEmployee(employee)}>
                Upraviť
              </button>
              <button type="button" style={dangerButtonStyle} onClick={() => deleteEmployee(employee.id)}>
                Zmazať
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
