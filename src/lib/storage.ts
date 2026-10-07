import { initialData } from './mockData'
import type { AppData } from './types'

const STORAGE_KEY = 'restaurante-dona-paty-v1'

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(initialData)

    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      settings: { ...initialData.settings, ...(parsed.settings || {}) },
      menu: Array.isArray(parsed.menu) ? parsed.menu : initialData.menu,
      sales: Array.isArray(parsed.sales) ? parsed.sales : initialData.sales,
      customers: Array.isArray(parsed.customers) ? parsed.customers : initialData.customers,
      creditMovements: Array.isArray(parsed.creditMovements)
        ? parsed.creditMovements
        : initialData.creditMovements,
    }
  } catch {
    return structuredClone(initialData)
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function resetData() {
  localStorage.removeItem(STORAGE_KEY)
}
