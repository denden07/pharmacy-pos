import { dbPromise } from '../db'

export default {
  namespaced: true,

  state: () => ({
    medicines: [],
    stockMap: {},
    priceHistoryMap: {},
    currentPage: 1,
    itemsPerPage: 10,
    totalCount: 0,
    loading: false
  }),

  getters: {
    totalPages: state =>
      Math.ceil(state.totalCount / state.itemsPerPage)
  },

  mutations: {
    SET_MEDICINES(state, list) {
      state.medicines = list
    },
    SET_STOCK_MAP(state, map) {
      state.stockMap = map
    },
    SET_PRICE_HISTORY_MAP(state, map) {
      state.priceHistoryMap = map
    },
    SET_TOTAL_COUNT(state, count) {
      state.totalCount = count
    },
    SET_CURRENT_PAGE(state, page) {
      state.currentPage = page
    },
    SET_LOADING(state, val) {
      state.loading = val
    }
  },

  actions: {
    // =============================
    // LOAD PAGE (DB SIDE FILTER)
    // =============================
    async loadMedicinesPage(
      { commit, state, dispatch },
      { page, itemsPerPage, filter, keyword, sortBy, sortOrder }
    ) {
      commit('SET_LOADING', true)

      const db = await dbPromise
      const store = db.transaction('medicines').objectStore('medicines')
      // Collect all matching items first, then sort and paginate in-memory.
      const all = []
      let cursor = await store.openCursor()
      while (cursor) {
        const m = { is_archived: false, ...cursor.value }

        // FILTER
        if (filter === 'active' && m.is_archived) {
          cursor = await cursor.continue()
          continue
        }
        if (filter === 'archived' && !m.is_archived) {
          cursor = await cursor.continue()
          continue
        }

        // SEARCH
        if (keyword) {
          const k = keyword.toLowerCase()
          if (
            !m.name.toLowerCase().includes(k) &&
            !(m.generic_name || '').toLowerCase().includes(k)
          ) {
            cursor = await cursor.continue()
            continue
          }
        }

        all.push(m)
        cursor = await cursor.continue()
      }

      commit('SET_TOTAL_COUNT', all.length)

      // Apply sorting
      const order = (a, b, dir = 'desc') => (dir === 'asc' ? a - b : b - a)

      if (sortBy === 'name') {
        all.sort((a, b) => {
          const na = (a.name || '').toLowerCase()
          const nb = (b.name || '').toLowerCase()
          if (na === nb) return 0
          if (sortOrder === 'asc') return na < nb ? -1 : 1
          return na > nb ? -1 : 1
        })
      } else if (sortBy === 'stock') {
        // compute stock for all items
        const invStore = db.transaction('inventory_batches').objectStore('inventory_batches')
        const stockMap = {}
        let c2 = await invStore.openCursor()
        while (c2) {
          const b = c2.value
          if (!stockMap[b.medicine_id]) stockMap[b.medicine_id] = 0
          stockMap[b.medicine_id] += b.quantity || 0
          c2 = await c2.continue()
        }
        all.sort((a, b) => {
          const sa = stockMap[a.id] || 0
          const sb = stockMap[b.id] || 0
          return sortOrder === 'asc' ? sa - sb : sb - sa
        })
      } else {
        // default: sort by most recent activity (sold or updated), then by id
        all.sort((a, b) => {
          const soldA = a.last_sold_at ? new Date(a.last_sold_at).getTime() : 0
          const soldB = b.last_sold_at ? new Date(b.last_sold_at).getTime() : 0
          const updatedA = a.updated_at ? new Date(a.updated_at).getTime() : 0
          const updatedB = b.updated_at ? new Date(b.updated_at).getTime() : 0

          const latestA = Math.max(soldA, updatedA)
          const latestB = Math.max(soldB, updatedB)

          if (latestB !== latestA) return latestB - latestA
          return b.id - a.id
        })
      }

      // Paginate
      const offset = (page - 1) * itemsPerPage
      const list = all.slice(offset, offset + itemsPerPage)

      commit('SET_MEDICINES', list)

      // Load related data only for this page
      await dispatch('loadStockForPage')
      await dispatch('loadPriceHistoryForPage')

      commit('SET_LOADING', false)
    },

    // =============================
    // PAGE STOCK
    // =============================
    async loadStockForPage({ state, commit }) {
      const db = await dbPromise
      const store = db.transaction('inventory_batches').objectStore('inventory_batches')

      const ids = state.medicines.map(m => m.id)
      const map = {}

      if (!ids.length) {
        commit('SET_STOCK_MAP', {})
        return
      }

      let cursor = await store.openCursor()
      while (cursor) {
        const b = cursor.value
        if (ids.includes(b.medicine_id)) {
          if (!map[b.medicine_id]) map[b.medicine_id] = 0
          map[b.medicine_id] += b.quantity || 0
        }
        cursor = await cursor.continue()
      }

      commit('SET_STOCK_MAP', map)
    },

    // =============================
    // PAGE PRICE HISTORY
    // =============================
    async loadPriceHistoryForPage({ state, commit }) {
      const db = await dbPromise
      const store = db.transaction('price_history').objectStore('price_history')

      const ids = state.medicines.map(m => m.id)
      const map = {}

      if (!ids.length) {
        commit('SET_PRICE_HISTORY_MAP', {})
        return
      }

      let cursor = await store.openCursor()
      while (cursor) {
        const row = cursor.value
        if (ids.includes(row.medicine_id)) {
          if (!map[row.medicine_id]) map[row.medicine_id] = []
          map[row.medicine_id].push(row)
        }
        cursor = await cursor.continue()
      }

      commit('SET_PRICE_HISTORY_MAP', map)
    },

    // =============================
    // ADD
    // =============================
    async addMedicine(_, medicine) {
      const db = await dbPromise
      const data = {
        ...medicine,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const id = await db.add('medicines', data)

      await db.add('price_history', {
        medicine_id: id,
        price1: medicine.price1,
        price2: medicine.price2,
        changed_at: new Date().toISOString()
      })
    },

    // =============================
    // UPDATE
    // =============================
    async updateMedicine(_, medicine) {
      const db = await dbPromise
      const current = await db.get('medicines', medicine.id)

      const priceChanged =
        current.price1 !== medicine.price1 ||
        current.price2 !== medicine.price2

      await db.put('medicines', {
        ...medicine,
        updated_at: new Date().toISOString()
      })

      if (priceChanged) {
        await db.add('price_history', {
          medicine_id: medicine.id,
          price1: medicine.price1,
          price2: medicine.price2,
          changed_at: new Date().toISOString()
        })
      }
    },

    // =============================
    // ARCHIVE / RESTORE
    // =============================
    async archiveMedicine(_, medicine) {
      const db = await dbPromise
      await db.put('medicines', {
        ...medicine,
        is_archived: true,
        updated_at: new Date().toISOString()
      })
    },

    async restoreMedicine(_, medicine) {
      const db = await dbPromise
      await db.put('medicines', {
        ...medicine,
        is_archived: false,
        updated_at: new Date().toISOString()
      })
    },

    async searchMedicines({ state }, keyword) {
      // query IndexedDB for medicines matching keyword
      const db = await dbPromise
      const all = await db.getAll('medicines')
      return all.filter(m => m.name.toLowerCase().includes(keyword.toLowerCase()))
    }
  }
}
