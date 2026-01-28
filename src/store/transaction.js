import { dbPromise } from '../db'

export default {
  namespaced: true,

  state: {
    pointsHistory: [],
    sales: []
  },

  mutations: {
    SET_POINTS_HISTORY(state, data) {
      state.pointsHistory = data
    },
    SET_SALES(state, data) {
      state.sales = data
    }
  },

  actions: {
    /* =========================
       LOAD POINTS HISTORY
    ========================== */
    async loadPointsHistory({ commit }, customerId = null) {
      const db = await dbPromise
      let data = []

      if (customerId) {
        const index = db.transaction('points_history')
          .store
          .index('customer_id')

        data = await index.getAll(customerId)
      } else {
        data = await db.getAll('points_history')
      }

      data.sort((a, b) => new Date(b.date) - new Date(a.date))
      commit('SET_POINTS_HISTORY', data)
      return data
    },

    /* =========================
       LOAD SALES
    ========================== */
    async loadSales({ commit }, customerId = null) {
      const db = await dbPromise
      let data = []

      if (customerId) {
        const index = db.transaction('sales')
          .store
          .index('customer_id')

        data = await index.getAll(customerId)
      } else {
        data = await db.getAll('sales')
      }

      data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      commit('SET_SALES', data)
      return data
    },

    /* =========================
       ADD POINTS FROM SALE
    ========================== */
    async addPointsFromSale({ dispatch }, payload) {
      const db = await dbPromise
      const points = Math.floor(payload.final_total / 200)
      if (points <= 0) return

      await db.add('points_history', {
        customer_id: payload.customer_id,
        points,
        type: 'sale',
        related_sale_id: payload.sale_id,
        notes: 'Auto from sale',
        date: new Date()
      })

      await dispatch('loadPointsHistory', payload.customer_id)
    }
  },

  getters: {
    totalPoints: (state) => {
      return state.pointsHistory.reduce((sum, p) => sum + p.points, 0)
    }
  }
}
