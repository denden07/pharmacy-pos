import { dbPromise } from '../db'
import Swal from 'sweetalert2'

export default {
  namespaced: true,

  state: () => ({
    customers: [],
    lastCustomerId: null
  }),

  mutations: {
    SET_CUSTOMERS(state, customers) {
      state.customers = customers
    },
    SET_LAST_CUSTOMER_ID(state, id) {
      state.lastCustomerId = id
    }
  },

  actions: {
    /* ==========================
      LOAD CUSTOMERS
    ========================== */
    async loadCustomers({ commit }) {
      const db = await dbPromise
      const customers = await db.getAll('customers')

      commit(
        'SET_CUSTOMERS',
        customers.map(c => ({
          ...c,
          created_at: new Date(c.created_at),
          updated_at: new Date(c.updated_at)
        }))
      )
    },

    /* ==========================
      ADD CUSTOMER
    ========================== */
    async addCustomer({ commit, dispatch }, payload) {
      const db = await dbPromise
      const now = new Date()

      const id = await db.add('customers', {
        name: payload.name,
        phone: payload.phone || '',
        email: payload.email || '',
        address: payload.address || '',
        created_at: now,
        updated_at: now,
        points: 0
      })

      commit('SET_LAST_CUSTOMER_ID', id)
      await dispatch('loadCustomers')

      return id
    },

    /* ==========================
      EDIT CUSTOMER
    ========================== */
    async editCustomer({ dispatch }, customer) {
      const db = await dbPromise

      await db.put('customers', {
        ...customer,
        updated_at: new Date()
      })

      await dispatch('loadCustomers')
    },

    /* ==========================
      DELETE CUSTOMER
    ========================== */
    async deleteCustomer({ dispatch }, customer) {
      const result = await Swal.fire({
        title: 'Delete Customer?',
        text: 'This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: 'Delete'
      })

      if (!result.isConfirmed) return

      const db = await dbPromise
      await db.delete('customers', customer.id)

      Swal.fire({
        icon: 'success',
        title: 'Customer Deleted',
        timer: 1200,
        showConfirmButton: false
      })

      await dispatch('loadCustomers')
    },

    /* ==========================
      SEARCH CUSTOMERS
    ========================== */
    async searchCustomers(_, keyword) {
      if (!keyword || !keyword.trim()) return []

      const db = await dbPromise
      const customers = await db.getAll('customers')
      const q = keyword.toLowerCase()

      return customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    },

    /* ==========================
      ADD POINTS FROM SALE
      (CALL THIS AFTER SAVING SALE)
    ========================== */
    async addPointsFromSale(_, { customer_id, sale_id, final_total }) {
      if (!customer_id) return

      const points = Math.floor(Number(final_total) / 200)
      if (points <= 0) return

      const db = await dbPromise

      await db.add('points_history', {
        customer_id,
        sale_id,
        points,
        date: new Date()
      })
    },

    /* ==========================
      GET CUSTOMER TOTAL POINTS
    ========================== */
    async getCustomerPoints(_, customer_id) {
      const db = await dbPromise
      const tx = db.transaction('points_history', 'readonly')
      const store = tx.objectStore('points_history')

      const records = await store
        .index('customer_id')
        .getAll(customer_id)

      return records.reduce((sum, r) => sum + Number(r.points || 0), 0)
    },

    // =========================
    // MANUAL POINTS ADJUSTMENT
    // =========================
    async addManualPoints(_, { customer_id, points, note = '' }) {
      const db = await dbPromise

      if (!customer_id || !Number.isFinite(points) || points === 0) return

      await db.add('points_history', {
        customer_id,
        points,                         // + or -
        type: 'manual',                 // manual | sale | void
        description: note || (points > 0 ? 'Manual add' : 'Manual deduction'),
        related_sale_id: null,
        date: new Date().toISOString()
      })


    },


    async updateCustomerPoints({ dispatch }, customer) {
      const db = await dbPromise
      await db.put('customers', customer)

      // reload customers list
      dispatch('loadCustomers')
    }

  },

  getters: {
    async getCustomerPointsHistory(_, customerId) {
      const db = await dbPromise
      const all = await db.getAll('points_history')
      return all.filter(p => p.customer_id === customerId)
    }

  }
}
