export type PaymentMethod = 'cash' | 'transfer' | 'credit'
export type MenuCategory = 'soup' | 'main' | 'drink' | 'extra'

export type QuickItem = {
  id: string
  name: string
  price: number
  emoji: string
}

export type MenuItem = {
  id: string
  name: string
  description: string
  category: MenuCategory
  price: number
  available: boolean
  emoji: string
}

export type SaleItem = {
  name: string
  quantity: number
  unitPrice: number
}

export type Sale = {
  id: string
  createdAt: string
  items: SaleItem[]
  total: number
  paymentMethod: PaymentMethod
  customerId?: string
  receiptName?: string
}

export type Customer = {
  id: string
  name: string
  phone: string
  note: string
  createdAt: string
}

export type CreditMovement = {
  id: string
  customerId: string
  type: 'charge' | 'payment'
  amount: number
  note: string
  createdAt: string
  saleId?: string
}

export type BusinessSettings = {
  businessName: string
  slogan: string
  phone: string
  bankName: string
  bankAccount: string
  accountHolder: string
  quickItems: QuickItem[]
}

export type AppData = {
  settings: BusinessSettings
  menu: MenuItem[]
  sales: Sale[]
  customers: Customer[]
  creditMovements: CreditMovement[]
}
