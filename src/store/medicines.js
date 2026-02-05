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
      { page, itemsPerPage, filter, keyword }
    ) {
      commit('SET_LOADING', true)

      const db = await dbPromise
      const store = db.transaction('medicines').objectStore('medicines')

      const offset = (page - 1) * itemsPerPage
      let count = 0
      let i = 0
      let list = []

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

        count++

        if (i >= offset && list.length < itemsPerPage) {
          list.push(m)
        }
        i++

        if (list.length >= itemsPerPage) break
        cursor = await cursor.continue()
      }

      commit('SET_TOTAL_COUNT', count)
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
        created_at: new Date(),
        updated_at: new Date()
      }

      const id = await db.add('medicines', data)

      await db.add('price_history', {
        medicine_id: id,
        price1: medicine.price1,
        price2: medicine.price2,
        changed_at: new Date()
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
        updated_at: new Date()
      })

      if (priceChanged) {
        await db.add('price_history', {
          medicine_id: medicine.id,
          price1: medicine.price1,
          price2: medicine.price2,
          changed_at: new Date()
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
        updated_at: new Date()
      })
    },

    async restoreMedicine(_, medicine) {
      const db = await dbPromise
      await db.put('medicines', {
        ...medicine,
        is_archived: false,
        updated_at: new Date()
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
