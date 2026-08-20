export type Customer = {
  id: string
  user_id: string
  nazov: string
  kontakt: string | null
  telefon: string | null
  email: string | null
  portal_code?: string | null
  created_at?: string
}

export type CustomerContact = {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  portal_code: string | null
  created_at?: string
  customers?: CustomerContactCustomer[]
}

export type CustomerContactCustomer = {
  id: string
  contact_id: string
  customer_id: string
  role: 'owner' | 'user'
  created_at?: string
}

export type Order = {
  id: string
  user_id: string
  nazov: string
  customer_id: string
  stav: string
  praca: string | null
  popis: string | null
  requester_email?: string | null
  public_message?: string | null
  progress_percent?: number | null
  termin: string | null
  prijatie_zakazky: string | null
  hodiny?: number | null
  created_at?: string
}

export type CustomerUpdate = {
  id: string
  order_id: string
  customer_id: string
  message: string
  attachment_urls: string[] | null
  seen_at?: string | null
  created_at?: string
}

export type Employee = {
  id: string
  user_id: string
  name: string
  telefon: string | null
  email: string | null
  active?: boolean | null
  can_delete?: boolean
  created_at?: string
}

export type OrderSubtask = {
  id: string
  order_id: string
  nazov: string
  completed: boolean
  created_at?: string
}

export type WorkLog = {
  id: string
  user_id: string
  order_id: string
  datum: string
  nazov_vykazu?: string | null
  start_time?: string | null
  end_time?: string | null
  praca_popis: string
  hodiny: number
  kilometre?: number | null
  zamestnanci: string[] | null
  created_at?: string
}

export type CalendarPlan = {
  id: string
  user_id: string
  order_id: string | null
  title: string | null
  plan_date: string
  start_time: string | null
  end_time: string | null
  note: string | null
  created_at?: string
}

export type DeliveryProtocol = {
  id: string
  user_id: string
  customer_id: string | null
  protocol_number: string
  protocol_date: string
  customer_name: string | null
  delivered_by: string | null
  received_by: string | null
  tested: boolean
  briefed: boolean
  items: unknown
  created_at?: string
  updated_at?: string
}

export type Quote = {
  id: string
  user_id: string
  customer_id: string | null
  quote_number: string
  quote_date: string
  valid_until: string | null
  status: 'draft' | 'sent' | 'approved' | 'rejected'
  title: string
  customer_name: string | null
  contact_name: string | null
  contact_email: string | null
  realization_note: string | null
  note: string | null
  discount_type?: 'none' | 'percent' | 'amount' | null
  discount_value?: string | number | null
  items: unknown
  created_at?: string
  updated_at?: string
}

export type MaintenanceRevision = {
  id: string
  user_id: string
  customer_id: string
  system_type: string
  title: string
  contact_name: string | null
  last_check_date: string | null
  interval_months: number
  next_due_date: string
  note: string | null
  active: boolean
  created_at?: string
  updated_at?: string
}

export type Notice =
  | {
      type: 'success' | 'error'
      text: string
    }
  | null
