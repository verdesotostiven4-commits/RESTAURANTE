import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured } from './lib/supabase'
import { loadData, resetData, saveData } from './lib/storage'
import type {
  AppData,
  Customer,
  MenuCategory,
  PaymentMethod,
  QuickItem,
  Sale,
  SaleItem,
} from './lib/types'

type View =
  | 'home'
  | 'quick-sale'
  | 'transfer'
  | 'clients'
  | 'customer'
  | 'menu'
  | 'public-menu'
  | 'closing'
  | 'history'
  | 'settings'

type CartLine = SaleItem & { id: string }

const money = (value: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value)

const shortDate = (value: string) =>
  new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const todayLabel = () =>
  new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

const isToday = (value: string) => {
  const d = new Date(value)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

const paymentLabel: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  credit: 'Fiado',
}

const categoryLabel: Record<MenuCategory, string> = {
  soup: 'Sopas',
  main: 'Segundos / platos',
  drink: 'Bebidas',
  extra: 'Extras',
}

function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [view, setView] = useState<View>('home')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [saleCustomerId, setSaleCustomerId] = useState('')
  const [receiptName, setReceiptName] = useState('')
  const [customName, setCustomName] = useState('Otro')
  const [customAmount, setCustomAmount] = useState('')

  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('Venta por transferencia')
  const [transferReceipt, setTransferReceipt] = useState('')

  const [clientSearch, setClientSearch] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', phone: '', note: '' })
  const [creditAmount, setCreditAmount] = useState('')
  const [creditNote, setCreditNote] = useState('Almuerzo fiado')

  const [newMenu, setNewMenu] = useState({
    name: '',
    description: '',
    category: 'main' as MenuCategory,
    price: '',
    emoji: '🍽️',
  })
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [historyMode, setHistoryMode] = useState<'today' | 'all'>('today')
  const [settingsDraft, setSettingsDraft] = useState(data.settings)

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const todaySales = useMemo(() => data.sales.filter((sale) => isToday(sale.createdAt)), [data.sales])

  const totals = useMemo(() => {
    const sum = (method: PaymentMethod) =>
      todaySales
        .filter((sale) => sale.paymentMethod === method)
        .reduce((acc, sale) => acc + sale.total, 0)

    return {
      cash: sum('cash'),
      transfer: sum('transfer'),
      credit: sum('credit'),
      sales: todaySales.reduce((acc, sale) => acc + sale.total, 0),
    }
  }, [todaySales])

  const getBalance = (customerId: string) =>
    data.creditMovements
      .filter((movement) => movement.customerId === customerId)
      .reduce(
        (balance, movement) =>
          movement.type === 'charge' ? balance + movement.amount : balance - movement.amount,
        0,
      )

  const totalOutstanding = data.customers.reduce(
    (total, customer) => total + Math.max(0, getBalance(customer.id)),
    0,
  )

  const cartTotal = cart.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0,
  )

  const selectedCustomer = selectedCustomerId
    ? data.customers.find((customer) => customer.id === selectedCustomerId)
    : undefined

  const notify = (message: string) => setToast(message)

  const go = (next: View) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addQuickItem = (item: QuickItem) => {
    setCart((current) => {
      const found = current.find((line) => line.id === item.id)
      if (found) {
        return current.map((line) =>
          line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
        )
      }
      return [...current, { id: item.id, name: item.name, quantity: 1, unitPrice: item.price }]
    })
  }

  const addCustomItem = () => {
    const amount = Number(customAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notify('Ingresa un valor válido')
      return
    }
    setCart((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: customName.trim() || 'Otro',
        quantity: 1,
        unitPrice: amount,
      },
    ])
    setCustomAmount('')
  }

  const removeCartItem = (id: string) => {
    setCart((current) => current.filter((line) => line.id !== id))
  }

  const registerSale = () => {
    if (!cart.length) {
      notify('Agrega al menos un producto')
      return
    }
    if (paymentMethod === 'credit' && !saleCustomerId) {
      notify('Selecciona el cliente del fiado')
      return
    }
    if (paymentMethod === 'transfer' && !receiptName) {
      notify('Adjunta el comprobante de la transferencia')
      return
    }

    const sale: Sale = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      items: cart.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice })),
      total: cartTotal,
      paymentMethod,
      customerId: paymentMethod === 'credit' ? saleCustomerId : undefined,
      receiptName: paymentMethod === 'transfer' ? receiptName : undefined,
    }

    setData((current) => ({
      ...current,
      sales: [sale, ...current.sales],
      creditMovements:
        paymentMethod === 'credit'
          ? [
              {
                id: crypto.randomUUID(),
                customerId: saleCustomerId,
                type: 'charge',
                amount: cartTotal,
                note: cart.map((item) => item.name).join(', '),
                createdAt: sale.createdAt,
                saleId: sale.id,
              },
              ...current.creditMovements,
            ]
          : current.creditMovements,
    }))

    setCart([])
    setPaymentMethod('cash')
    setSaleCustomerId('')
    setReceiptName('')
    notify('Venta registrada')
    go('home')
  }

  const saveDirectTransfer = () => {
    const amount = Number(transferAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notify('Ingresa el monto recibido')
      return
    }
    if (!transferReceipt) {
      notify('Adjunta el comprobante')
      return
    }

    const sale: Sale = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      items: [{ name: transferNote.trim() || 'Venta por transferencia', quantity: 1, unitPrice: amount }],
      total: amount,
      paymentMethod: 'transfer',
      receiptName: transferReceipt,
    }

    setData((current) => ({ ...current, sales: [sale, ...current.sales] }))
    setTransferAmount('')
    setTransferReceipt('')
    notify('Transferencia guardada')
    go('home')
  }

  const createCustomer = () => {
    if (!newClient.name.trim()) {
      notify('Escribe el nombre o apodo')
      return
    }

    const customer: Customer = {
      id: crypto.randomUUID(),
      name: newClient.name.trim(),
      phone: newClient.phone.trim(),
      note: newClient.note.trim(),
      createdAt: new Date().toISOString(),
    }

    setData((current) => ({ ...current, customers: [customer, ...current.customers] }))
    setNewClient({ name: '', phone: '', note: '' })
    setShowNewClient(false)
    notify('Cliente creado')
  }

  const addCreditMovement = (type: 'charge' | 'payment', liquidate = false) => {
    if (!selectedCustomer) return

    const balance = Math.max(0, getBalance(selectedCustomer.id))
    const amount = liquidate ? balance : Number(creditAmount)

    if (!Number.isFinite(amount) || amount <= 0) {
      notify(liquidate ? 'Este cliente no tiene saldo pendiente' : 'Ingresa un valor válido')
      return
    }

    const createdAt = new Date().toISOString()
    const movement = {
      id: crypto.randomUUID(),
      customerId: selectedCustomer.id,
      type,
      amount,
      note: liquidate
        ? 'Liquidación total'
        : creditNote.trim() || (type === 'charge' ? 'Fiado' : 'Abono'),
      createdAt,
    } as const

    setData((current) => {
      const nextSales =
        type === 'charge'
          ? [
              {
                id: crypto.randomUUID(),
                createdAt,
                items: [{ name: movement.note, quantity: 1, unitPrice: amount }],
                total: amount,
                paymentMethod: 'credit' as const,
                customerId: selectedCustomer.id,
              },
              ...current.sales,
            ]
          : current.sales

      return {
        ...current,
        sales: nextSales,
        creditMovements: [movement, ...current.creditMovements],
      }
    })

    setCreditAmount('')
    notify(type === 'charge' ? 'Fiado agregado' : 'Abono registrado')
  }

  const updateMenuItem = (id: string, patch: Partial<AppData['menu'][number]>) => {
    setData((current) => ({
      ...current,
      menu: current.menu.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }

  const addMenuItem = () => {
    const price = Number(newMenu.price)
    if (!newMenu.name.trim() || !Number.isFinite(price) || price < 0) {
      notify('Completa el nombre y precio')
      return
    }

    setData((current) => ({
      ...current,
      menu: [
        ...current.menu,
        {
          id: crypto.randomUUID(),
          name: newMenu.name.trim(),
          description: newMenu.description.trim(),
          category: newMenu.category,
          price,
          available: true,
          emoji: newMenu.emoji || '🍽️',
        },
      ],
    }))
    setNewMenu({ name: '', description: '', category: 'main', price: '', emoji: '🍽️' })
    setShowNewMenu(false)
    notify('Plato agregado')
  }

  const saveSettings = () => {
    setData((current) => ({ ...current, settings: settingsDraft }))
    notify('Configuración guardada')
  }

  const updateQuickPrice = (id: string, price: number) => {
    setSettingsDraft((current) => ({
      ...current,
      quickItems: current.quickItems.map((item) =>
        item.id === id ? { ...item, price: Math.max(0, price || 0) } : item,
      ),
    }))
  }

  const filteredCustomers = data.customers.filter((customer) =>
    customer.name.toLowerCase().includes(clientSearch.toLowerCase()),
  )

  const historySales = historyMode === 'today' ? todaySales : data.sales

  const renderHeader = (title?: string, backTo?: View) => (
    <header className="topbar">
      <div className="brand-line">
        {backTo ? (
          <button className="icon-button" onClick={() => go(backTo)} aria-label="Volver">
            ←
          </button>
        ) : (
          <div className="brand-mark">DP</div>
        )}
        <div>
          <p className="eyebrow">{title || data.settings.businessName}</p>
          <h1>{title ? data.settings.businessName : 'Control simple del negocio'}</h1>
        </div>
      </div>
      <div className={'mode-dot ' + (isSupabaseConfigured ? 'online' : 'demo')} title="Estado">
        {isSupabaseConfigured ? 'Nube' : 'Local'}
      </div>
    </header>
  )

  const home = (
    <>
      {renderHeader()}
      <section className="hero">
        <div>
          <p className="eyebrow">Hoy</p>
          <h2 className="capitalize">{todayLabel()}</h2>
          <p>Todo lo importante del restaurante en una sola pantalla.</p>
        </div>
        <div className="hero-badge">🍲</div>
      </section>

      <section className="metrics three">
        <Metric icon="💵" label="Efectivo" value={money(totals.cash)} tone="green" />
        <Metric icon="📲" label="Transferencias" value={money(totals.transfer)} tone="yellow" />
        <Metric icon="🧾" label="Fiado hoy" value={money(totals.credit)} tone="peach" />
      </section>

      <section className="action-grid">
        <ActionCard
          icon="🧮"
          title="Cobro rápido"
          subtitle="Registra una venta en segundos"
          tone="orange"
          onClick={() => go('quick-sale')}
        />
        <ActionCard
          icon="📸"
          title="Transferencias"
          subtitle="Monto + comprobante"
          tone="yellow"
          onClick={() => go('transfer')}
        />
        <ActionCard
          icon="📒"
          title="Fiados"
          subtitle={money(totalOutstanding) + ' pendiente'}
          tone="cream"
          onClick={() => go('clients')}
        />
        <ActionCard
          icon="🍽️"
          title="Menú del día"
          subtitle="Disponible / agotado"
          tone="peach"
          onClick={() => go('menu')}
        />
      </section>

      <button className="wide-card green-card" onClick={() => go('closing')}>
        <span>📊</span>
        <span>
          <strong>Cierre diario</strong>
          <small>Revisa ventas y métodos de pago</small>
        </span>
        <span>›</span>
      </button>

      <button className="wide-card soft-card" onClick={() => go('public-menu')}>
        <span>📱</span>
        <span>
          <strong>Vista del cliente / QR</strong>
          <small>Así verán el menú los estudiantes</small>
        </span>
        <span>›</span>
      </button>

      {!isSupabaseConfigured && (
        <div className="notice">
          <strong>Modo local activo.</strong> Todo funciona para pruebas en este dispositivo. Al
          conectar Supabase, los datos se sincronizarán entre los celulares.
        </div>
      )}
    </>
  )

  const quickSale = (
    <>
      {renderHeader('Cobro rápido', 'home')}
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">1. Agrega productos</p>
            <h2>¿Qué pidió?</h2>
          </div>
          <button className="text-button" onClick={() => setCart([])}>Limpiar</button>
        </div>

        <div className="product-grid">
          {data.settings.quickItems.map((item) => (
            <button className="product-button" key={item.id} onClick={() => addQuickItem(item)}>
              <span className="product-emoji">{item.emoji}</span>
              <strong>{item.name}</strong>
              <span>{money(item.price)}</span>
            </button>
          ))}
        </div>

        <div className="inline-form">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Otro concepto"
          />
          <input
            inputMode="decimal"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="$"
          />
          <button onClick={addCustomItem}>＋</button>
        </div>
      </section>

      <section className="section-card">
        <p className="eyebrow">2. Método de pago</p>
        <div className="payment-grid">
          {(['cash', 'transfer', 'credit'] as PaymentMethod[]).map((method) => (
            <button
              key={method}
              className={'payment-button ' + (paymentMethod === method ? 'active' : '')}
              onClick={() => setPaymentMethod(method)}
            >
              <span>{method === 'cash' ? '💵' : method === 'transfer' ? '📲' : '📒'}</span>
              <strong>{paymentLabel[method]}</strong>
            </button>
          ))}
        </div>

        {paymentMethod === 'credit' && (
          <label className="field">
            <span>Cliente</span>
            <select value={saleCustomerId} onChange={(e) => setSaleCustomerId(e.target.value)}>
              <option value="">Seleccionar cliente</option>
              {data.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · debe {money(Math.max(0, getBalance(customer.id)))}
                </option>
              ))}
            </select>
          </label>
        )}

        {paymentMethod === 'transfer' && (
          <label className="upload-box">
            <span className="upload-icon">📸</span>
            <strong>{receiptName || 'Tomar foto / subir comprobante'}</strong>
            <small>La foto irá a Supabase Storage cuando conectemos la nube.</small>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setReceiptName(e.target.files?.[0]?.name || '')}
            />
          </label>
        )}
      </section>

      <section className="section-card cart-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Venta actual</p>
            <h2>{cart.length ? cart.length + ' conceptos' : 'Sin productos'}</h2>
          </div>
          <strong className="big-total">{money(cartTotal)}</strong>
        </div>

        <div className="simple-list">
          {cart.map((item) => (
            <div className="list-row" key={item.id}>
              <div>
                <strong>{item.quantity} × {item.name}</strong>
                <small>{money(item.unitPrice)} c/u</small>
              </div>
              <div className="row-actions">
                <strong>{money(item.unitPrice * item.quantity)}</strong>
                <button className="mini-danger" onClick={() => removeCartItem(item.id)}>×</button>
              </div>
            </div>
          ))}
        </div>

        <button className="primary-button" onClick={registerSale}>
          Registrar venta · {money(cartTotal)}
        </button>
      </section>
    </>
  )

  const transfer = (
    <>
      {renderHeader('Pago por transferencia', 'home')}
      <section className="section-card">
        <div className="transfer-icon">📲</div>
        <h2>Registrar transferencia</h2>
        <p>Guarda el monto junto al comprobante para que no se pierda entre las fotos del celular.</p>

        <label className="field">
          <span>Monto recibido</span>
          <input
            inputMode="decimal"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="2.50"
          />
        </label>

        <label className="field">
          <span>Concepto</span>
          <input
            value={transferNote}
            onChange={(e) => setTransferNote(e.target.value)}
            placeholder="Ej. Almuerzo"
          />
        </label>

        <div className="bank-card">
          <span>🏦</span>
          <div>
            <strong>{data.settings.bankName}</strong>
            <small>{data.settings.bankAccount || 'Cuenta por confirmar'}</small>
          </div>
        </div>

        <label className="upload-box">
          <span className="upload-icon">📷</span>
          <strong>{transferReceipt || 'Tomar foto del comprobante'}</strong>
          <small>También puedes elegir una captura ya guardada.</small>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setTransferReceipt(e.target.files?.[0]?.name || '')}
          />
        </label>

        <button className="primary-button green" onClick={saveDirectTransfer}>Guardar pago</button>
      </section>
    </>
  )

  const clients = (
    <>
      {renderHeader('Clientes fiados', 'home')}
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cuaderno digital</p>
            <h2>{money(totalOutstanding)} pendiente</h2>
          </div>
          <button className="small-button" onClick={() => setShowNewClient((value) => !value)}>
            ＋ Cliente
          </button>
        </div>

        {showNewClient && (
          <div className="form-stack inset-form">
            <label className="field">
              <span>Nombre o apodo *</span>
              <input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Teléfono (opcional)</span>
              <input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
            </label>
            <label className="field">
              <span>Nota</span>
              <input value={newClient.note} onChange={(e) => setNewClient({ ...newClient, note: e.target.value })} />
            </label>
            <button className="primary-button" onClick={createCustomer}>Guardar cliente</button>
          </div>
        )}

        <label className="search-box">
          <span>⌕</span>
          <input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Buscar cliente o apodo"
          />
        </label>

        <div className="customer-list">
          {filteredCustomers.map((customer) => {
            const balance = Math.max(0, getBalance(customer.id))
            return (
              <button
                className="customer-row"
                key={customer.id}
                onClick={() => {
                  setSelectedCustomerId(customer.id)
                  setCreditAmount('')
                  setCreditNote('Almuerzo fiado')
                  go('customer')
                }}
              >
                <div className="avatar">{customer.name.slice(0, 2).toUpperCase()}</div>
                <div className="grow">
                  <strong>{customer.name}</strong>
                  <small>{customer.note || 'Cliente del restaurante'}</small>
                </div>
                <div className={balance > 0 ? 'debt' : 'clear'}>
                  <strong>{money(balance)}</strong>
                  <small>{balance > 0 ? 'Debe' : 'Al corriente'}</small>
                </div>
                <span>›</span>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )

  const customerDetail = selectedCustomer ? (
    <>
      {renderHeader('Cliente', 'clients')}
      <section className="customer-profile">
        <div className="large-avatar">{selectedCustomer.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <h2>{selectedCustomer.name}</h2>
          <p>{selectedCustomer.note || 'Cliente conocido'}</p>
        </div>
      </section>

      <section className="debt-card">
        <span>Saldo pendiente</span>
        <strong>{money(Math.max(0, getBalance(selectedCustomer.id)))}</strong>
        <small>Se calcula automáticamente con cargos y abonos.</small>
      </section>

      <section className="section-card">
        <div className="form-grid-two">
          <label className="field">
            <span>Valor</span>
            <input
              inputMode="decimal"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="2.50"
            />
          </label>
          <label className="field">
            <span>Nota</span>
            <input
              value={creditNote}
              onChange={(e) => setCreditNote(e.target.value)}
              placeholder="Almuerzo fiado"
            />
          </label>
        </div>

        <div className="credit-actions">
          <button className="danger-action" onClick={() => addCreditMovement('charge')}>
            ＋ Agregar fiado
          </button>
          <button className="warm-action" onClick={() => addCreditMovement('payment')}>
            ↓ Abonar
          </button>
          <button className="green-action" onClick={() => addCreditMovement('payment', true)}>
            ✓ Liquidar
          </button>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historial</p>
            <h2>Movimientos</h2>
          </div>
        </div>

        <div className="simple-list">
          {data.creditMovements
            .filter((movement) => movement.customerId === selectedCustomer.id)
            .map((movement) => (
              <div className="list-row" key={movement.id}>
                <div>
                  <strong>{movement.note}</strong>
                  <small>{shortDate(movement.createdAt)}</small>
                </div>
                <strong className={movement.type === 'charge' ? 'red-text' : 'green-text'}>
                  {movement.type === 'charge' ? '+' : '−'}{money(movement.amount)}
                </strong>
              </div>
            ))}
        </div>
      </section>
    </>
  ) : clients

  const menu = (
    <>
      {renderHeader('Menú del día', 'home')}
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Editor</p>
            <h2>Platos publicados</h2>
          </div>
          <button className="small-button" onClick={() => setShowNewMenu((value) => !value)}>＋ Plato</button>
        </div>

        {showNewMenu && (
          <div className="form-stack inset-form">
            <div className="form-grid-two">
              <label className="field">
                <span>Nombre</span>
                <input value={newMenu.name} onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Precio</span>
                <input inputMode="decimal" value={newMenu.price} onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>Descripción</span>
              <input value={newMenu.description} onChange={(e) => setNewMenu({ ...newMenu, description: e.target.value })} />
            </label>
            <div className="form-grid-two">
              <label className="field">
                <span>Categoría</span>
                <select value={newMenu.category} onChange={(e) => setNewMenu({ ...newMenu, category: e.target.value as MenuCategory })}>
                  {Object.entries(categoryLabel).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Emoji temporal</span>
                <input value={newMenu.emoji} onChange={(e) => setNewMenu({ ...newMenu, emoji: e.target.value })} />
              </label>
            </div>
            <button className="primary-button" onClick={addMenuItem}>Agregar al menú</button>
          </div>
        )}

        {(['soup', 'main', 'drink', 'extra'] as MenuCategory[]).map((category) => {
          const items = data.menu.filter((item) => item.category === category)
          if (!items.length) return null
          return (
            <div className="menu-group" key={category}>
              <h3>{categoryLabel[category]}</h3>
              {items.map((item) => (
                <div className="menu-admin-row" key={item.id}>
                  <div className="menu-emoji">{item.emoji}</div>
                  <div className="grow">
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                    <div className="menu-edit-line">
                      <span>$</span>
                      <input
                        inputMode="decimal"
                        value={item.price}
                        onChange={(e) => updateMenuItem(item.id, { price: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <button
                    className={'availability ' + (item.available ? 'available' : 'soldout')}
                    onClick={() => updateMenuItem(item.id, { available: !item.available })}
                  >
                    {item.available ? 'Disponible' : 'Agotado'}
                  </button>
                </div>
              ))}
            </div>
          )
        })}

        <button className="primary-button" onClick={() => go('public-menu')}>Ver menú público</button>
      </section>
    </>
  )

  const publicMenu = (
    <>
      {renderHeader('Vista del cliente', 'menu')}
      <section className="public-hero">
        <div className="brand-mark large">DP</div>
        <p className="eyebrow">Menú de hoy</p>
        <h2>{data.settings.businessName}</h2>
        <p>{data.settings.slogan}</p>
      </section>

      <section className="public-menu-list">
        {data.menu.map((item) => (
          <article className={'public-menu-item ' + (!item.available ? 'disabled' : '')} key={item.id}>
            <div className="public-food">{item.emoji}</div>
            <div className="grow">
              <strong>{item.name}</strong>
              <p>{item.description}</p>
            </div>
            {item.available ? <b>{money(item.price)}</b> : <span className="soldout-chip">Agotado</span>}
          </article>
        ))}
      </section>

      <section className="pay-public">
        <div>
          <p className="eyebrow">Pago por transferencia</p>
          <h3>{data.settings.bankName}</h3>
          <p>{data.settings.bankAccount || 'Datos de cuenta por confirmar'}</p>
          {data.settings.accountHolder && <small>A nombre de {data.settings.accountHolder}</small>}
        </div>
        <div className="qr-placeholder">QR</div>
      </section>

      <div className="notice">
        Este será el enlace que abriremos desde el QR de las mesas. Los clientes no necesitan cuenta ni instalar nada.
      </div>
    </>
  )

  const closing = (
    <>
      {renderHeader('Cierre diario', 'home')}
      <section className="closing-total">
        <p>Total de ventas registradas hoy</p>
        <strong>{money(totals.sales)}</strong>
        <small>{todaySales.length} ventas</small>
      </section>

      <section className="metrics three">
        <Metric icon="💵" label="Efectivo" value={money(totals.cash)} tone="green" />
        <Metric icon="📲" label="Transferencias" value={money(totals.transfer)} tone="yellow" />
        <Metric icon="📒" label="Fiado" value={money(totals.credit)} tone="peach" />
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Últimos movimientos</p>
            <h2>Ventas de hoy</h2>
          </div>
          <button className="text-button" onClick={() => go('history')}>Ver todas</button>
        </div>
        <div className="simple-list">
          {todaySales.slice(0, 8).map((sale) => (
            <SaleRow key={sale.id} sale={sale} customers={data.customers} />
          ))}
          {!todaySales.length && <Empty text="Aún no hay ventas registradas hoy." />}
        </div>
      </section>

      <div className="notice">
        Para el cuadre real, el efectivo debe contarse físicamente. La app muestra lo que se registró y ayuda a detectar diferencias.
      </div>
    </>
  )

  const history = (
    <>
      {renderHeader('Historial de ventas', 'home')}
      <section className="section-card">
        <div className="segmented">
          <button className={historyMode === 'today' ? 'active' : ''} onClick={() => setHistoryMode('today')}>Hoy</button>
          <button className={historyMode === 'all' ? 'active' : ''} onClick={() => setHistoryMode('all')}>Todo</button>
        </div>

        <div className="history-summary">
          <span>Total mostrado</span>
          <strong>{money(historySales.reduce((sum, sale) => sum + sale.total, 0))}</strong>
        </div>

        <div className="simple-list">
          {historySales.map((sale) => (
            <SaleRow key={sale.id} sale={sale} customers={data.customers} />
          ))}
          {!historySales.length && <Empty text="No hay movimientos para mostrar." />}
        </div>
      </section>
    </>
  )

  const settings = (
    <>
      {renderHeader('Configuración', 'home')}
      <section className="section-card form-stack">
        <label className="field">
          <span>Nombre del restaurante</span>
          <input
            value={settingsDraft.businessName}
            onChange={(e) => setSettingsDraft({ ...settingsDraft, businessName: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Frase / descripción</span>
          <input
            value={settingsDraft.slogan}
            onChange={(e) => setSettingsDraft({ ...settingsDraft, slogan: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Teléfono</span>
          <input
            value={settingsDraft.phone}
            onChange={(e) => setSettingsDraft({ ...settingsDraft, phone: e.target.value })}
          />
        </label>

        <div className="settings-group">
          <h3>Datos para transferencias</h3>
          <label className="field">
            <span>Banco</span>
            <input
              value={settingsDraft.bankName}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, bankName: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Número de cuenta</span>
            <input
              value={settingsDraft.bankAccount}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, bankAccount: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Titular</span>
            <input
              value={settingsDraft.accountHolder}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, accountHolder: e.target.value })}
            />
          </label>
        </div>

        <div className="settings-group">
          <h3>Precios rápidos</h3>
          {settingsDraft.quickItems.map((item) => (
            <div className="quick-setting" key={item.id}>
              <span>{item.emoji} {item.name}</span>
              <div>
                <span>$</span>
                <input
                  inputMode="decimal"
                  value={item.price}
                  onChange={(e) => updateQuickPrice(item.id, Number(e.target.value))}
                />
              </div>
            </div>
          ))}
        </div>

        <button className="primary-button" onClick={saveSettings}>Guardar cambios</button>
      </section>

      <section className="section-card">
        <h3>Estado del sistema</h3>
        <div className="status-line">
          <span>Base de datos</span>
          <strong>{isSupabaseConfigured ? 'Supabase conectado' : 'Pendiente · modo local'}</strong>
        </div>
        <div className="status-line">
          <span>Instalable en celular</span>
          <strong>Sí · PWA preparada</strong>
        </div>
        <div className="status-line">
          <span>Sincronización entre celulares</span>
          <strong>{isSupabaseConfigured ? 'Preparada' : 'Se activa con Supabase'}</strong>
        </div>
      </section>

      <button
        className="danger-outline"
        onClick={() => {
          resetData()
          window.location.reload()
        }}
      >
        Restaurar datos demo de este dispositivo
      </button>
    </>
  )

  const content = {
    home,
    'quick-sale': quickSale,
    transfer,
    clients,
    customer: customerDetail,
    menu,
    'public-menu': publicMenu,
    closing,
    history,
    settings,
  }

  return (
    <div className="app-shell">
      <main className="app-content">{content[view]}</main>
      {view !== 'public-menu' && (
        <nav className="bottom-nav" aria-label="Navegación principal">
          <NavButton icon="⌂" label="Inicio" active={view === 'home'} onClick={() => go('home')} />
          <NavButton icon="▤" label="Ventas" active={view === 'history' || view === 'quick-sale' || view === 'transfer'} onClick={() => go('history')} />
          <NavButton icon="♟" label="Clientes" active={view === 'clients' || view === 'customer'} onClick={() => go('clients')} />
          <NavButton icon="♨" label="Menú" active={view === 'menu'} onClick={() => go('menu')} />
          <NavButton icon="•••" label="Más" active={view === 'settings'} onClick={() => go('settings')} />
        </nav>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: string
  label: string
  value: string
  tone: 'green' | 'yellow' | 'peach'
}) {
  return (
    <article className={'metric ' + tone}>
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  )
}

function ActionCard({
  icon,
  title,
  subtitle,
  tone,
  onClick,
}: {
  icon: string
  title: string
  subtitle: string
  tone: 'orange' | 'yellow' | 'cream' | 'peach'
  onClick: () => void
}) {
  return (
    <button className={'action-card ' + tone} onClick={onClick}>
      <span className="action-icon">{icon}</span>
      <strong>{title}</strong>
      <small>{subtitle}</small>
      <b>›</b>
    </button>
  )
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      <span>{icon}</span>
      <small>{label}</small>
    </button>
  )
}

function SaleRow({ sale, customers }: { sale: Sale; customers: Customer[] }) {
  const customer = sale.customerId
    ? customers.find((item) => item.id === sale.customerId)
    : undefined
  return (
    <div className="list-row">
      <div className="sale-main">
        <strong>{sale.items.map((item) => item.name).join(' + ')}</strong>
        <small>
          {shortDate(sale.createdAt)} · {paymentLabel[sale.paymentMethod]}
          {customer ? ' · ' + customer.name : ''}
        </small>
      </div>
      <div className="sale-right">
        <strong>{money(sale.total)}</strong>
        {sale.receiptName && <small>📎 Comprobante</small>}
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>
}

export default App
