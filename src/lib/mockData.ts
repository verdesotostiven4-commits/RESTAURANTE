import type { AppData } from './types'

const now = new Date()
const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString()

export const initialData: AppData = {
  settings: {
    businessName: 'Restaurante Doña Paty',
    slogan: 'Comida casera cerca de la U',
    phone: '',
    bankName: 'Banco por confirmar',
    bankAccount: '',
    accountHolder: '',
    quickItems: [
      { id: 'almuerzo', name: 'Almuerzo', price: 2.5, emoji: '🍛' },
      { id: 'medio', name: 'Medio almuerzo', price: 2, emoji: '🍲' },
      { id: 'especial', name: 'Especial', price: 3, emoji: '🍽️' },
      { id: 'bebida', name: 'Bebida', price: 0.5, emoji: '🥤' },
    ],
  },
  menu: [
    { id: 'sopa-1', name: 'Sopa del día', description: 'Por confirmar mañana', category: 'soup', price: 1, available: true, emoji: '🥣' },
    { id: 'segundo-1', name: 'Pollo del día', description: 'Plato de ejemplo', category: 'main', price: 2.5, available: true, emoji: '🍗' },
    { id: 'segundo-2', name: 'Plato especial', description: 'Plato de ejemplo', category: 'main', price: 3, available: true, emoji: '🍽️' },
    { id: 'bebida-1', name: 'Bebida', description: 'Bebida de ejemplo', category: 'drink', price: 0.5, available: true, emoji: '🥤' },
  ],
  customers: [
    { id: 'cliente-kevin', name: 'Kevin Sistemas', phone: '', note: 'Cliente conocido', createdAt: at(240) },
    { id: 'cliente-carlos', name: 'Carlos Medicina', phone: '', note: '', createdAt: at(200) },
    { id: 'cliente-anita', name: 'Anita', phone: '', note: '', createdAt: at(180) },
  ],
  creditMovements: [
    { id: 'mov-1', customerId: 'cliente-kevin', type: 'charge', amount: 2.5, note: 'Almuerzo fiado', createdAt: at(28) },
    { id: 'mov-2', customerId: 'cliente-kevin', type: 'charge', amount: 2.5, note: 'Almuerzo fiado', createdAt: at(10) },
    { id: 'mov-3', customerId: 'cliente-carlos', type: 'charge', amount: 3, note: 'Plato especial', createdAt: at(48) },
    { id: 'mov-4', customerId: 'cliente-carlos', type: 'payment', amount: 1, note: 'Abono en efectivo', createdAt: at(24) },
  ],
  sales: [
    {
      id: 'sale-demo-1',
      createdAt: at(4),
      items: [{ name: 'Almuerzo', quantity: 1, unitPrice: 2.5 }],
      total: 2.5,
      paymentMethod: 'cash',
    },
    {
      id: 'sale-demo-2',
      createdAt: at(3),
      items: [{ name: 'Especial', quantity: 1, unitPrice: 3 }],
      total: 3,
      paymentMethod: 'transfer',
      receiptName: 'comprobante-demo.jpg',
    },
  ],
}
