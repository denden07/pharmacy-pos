import { dbPromise } from '../db'
import Swal from 'sweetalert2'

export default {
  namespaced: true,

  state: () => ({
    page: [],
    total: 0,
    lastCustomerId: null,
    loading: false
  }),

  mutations: {
    SET_PAGE(state, rows) {
      state.page = rows
    },
    SET_TOTAL(state, n) {
      state.total = n
    },
    SET_LAST_CUSTOMER_ID(state, id) {
      state.lastCustomerId = id
    },
    SET_LOADING(state, v) {
      state.loading = v
    }
  },

  actions: {
    /* ==========================
       PAGED LOAD (MAIN ENTRY)
    ========================== */
async loadCustomersPage(
  { commit },
  { page = 1, perPage = 10, search = '', sortBy = 'created_at', sortOrder = 'desc' }
) {
  commit('SET_LOADING', true)

  const db = await dbPromise
  const tx = db.transaction(['customers', 'points_history'], 'readonly')
  const store = tx.objectStore('customers')
  const pointsStore = tx.objectStore('points_history')

  // choose index for cursor
  const index = sortBy === 'name' ? store.index('name') : store.index('created_at')
  const direction = sortOrder === 'desc' ? 'prev' : 'next'
  let cursor = await index.openCursor(null, direction)

  const q = search.trim().toLowerCase()
  let rows = []
  let allMatching = [] // store all for points sort if needed
  let skipped = 0
  let total = 0

  while (cursor) {
    const c = cursor.value
    const match =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)

    if (match) {
      total++ // count total matches

      if (sortBy === 'points') {
        // collect all for points sorting later
        allMatching.push({ ...c })
      } else {
        // only compute points for the page rows
        const offset = (page - 1) * perPage
        if (skipped < offset) {
          skipped++
        } else if (rows.length < perPage) {
          const recs = await pointsStore.index('customer_id').getAll(c.id)
          c.points = recs.reduce((s, r) => s + Number(r.points || 0), 0)
          rows.push({ ...c })
        }
      }
    }

    cursor = await cursor.continue().catch(() => null)
  }

  // sort by points if needed
  if (sortBy === 'points') {
    for (const row of allMatching) {
      const recs = await pointsStore.index('customer_id').getAll(row.id)
      row.points = recs.reduce((s, r) => s + Number(r.points || 0), 0)
    }

    allMatching.sort((a, b) =>
      sortOrder === 'asc' ? a.points - b.points : b.points - a.points
    )

    const offset = (page - 1) * perPage
    rows = allMatching.slice(offset, offset + perPage)
  }

  commit('SET_PAGE', rows)
  commit('SET_TOTAL', total)
  commit('SET_LOADING', false)
},





    /* ==========================
       ADD CUSTOMER
    ========================== */
    async addCustomer({ commit }, payload) {
      const db = await dbPromise
      const now = new Date()

      const id = await db.add('customers', {
        name: payload.name,
        phone: payload.phone || '',
        email: payload.email || '',
        address: payload.address || '',
        created_at: now,
        updated_at: now
      })

      commit('SET_LAST_CUSTOMER_ID', id)
      return id
    },

    /* ==========================
       EDIT
    ========================== */
    async editCustomer(_, customer) {
      const db = await dbPromise
      await db.put('customers', {
        ...customer,
        updated_at: new Date()
      })
    },

    /* ==========================
       DELETE
    ========================== */
    async deleteCustomer(_, customer) {
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
    },

    /* ==========================
       POINTS
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
        type: 'sale',
        date: new Date()
      })
    },


async addManualPoints(_, { customer_id, points, note = '' }) {
  if (!customer_id || !Number.isFinite(points) || points === 0) return

  const db = await dbPromise
  const tx = db.transaction(['points_history', 'yearly_points'], 'readwrite')
  const pointsStore = tx.objectStore('points_history')
  const yearlyStore = tx.objectStore('yearly_points')

  const now = new Date()
  const year = now.getFullYear()
  const yearlyKey = [customer_id, year]

  // 1️⃣ Add to points_history
  await pointsStore.add({
    customer_id,
    points,
    type: 'manual',
    description: note || (points > 0 ? 'Manual add' : 'Manual deduction'),
    related_sale_id: null,
    date: now
  })

  // 2️⃣ Update yearly_points
  let yearly = await yearlyStore.get(yearlyKey)
  if (!yearly) yearly = { customer_id, year, points: 0 }
  yearly.points += points
  if (yearly.points < 0) yearly.points = 0
  await yearlyStore.put(yearly)

  await tx.done
},




    async getCustomerPointsHistory(_, customerId) {
      const db = await dbPromise
      const store = db.transaction('points_history').objectStore('points_history')
      return store.index('customer_id').getAll(customerId)
    },
    async searchCustomers({ state }, keyword) {
    const db = await dbPromise
    const all = await db.getAll('customers')
    return all.filter(c => c.name.toLowerCase().includes(keyword.toLowerCase()))
  }
  }
}
