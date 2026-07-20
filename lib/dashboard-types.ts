export type Customer = {
  id: string
  user_id: string
  nazov: string
  kontakt: string | null
  telefon: string | null
  email: string | null
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
  termin: string | null
  prijatie_zakazky: string | null
  hodiny?: number | null
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

export type Notice =
  | {
      type: 'success' | 'error'
      text: string
    }
  | null
