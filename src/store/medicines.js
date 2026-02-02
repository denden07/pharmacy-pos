import { dbPromise } from '../db'

export default {
  namespaced: true,

  state: () => ({
    medicines: [],
    loading: false
  }),

  getters: {
    all: state => state.medicines,

    byName: state => keyword =>
      state.medicines.filter(m =>
        m.name.toLowerCase().includes(keyword.toLowerCase())
      )
  },

  mutations: {
    SET_MEDICINES(state, medicines) {
      state.medicines = medicines
    },

    ADD_MEDICINE(state, medicine) {
      state.medicines.push(medicine)
    },

    UPDATE_MEDICINE(state, updated) {
      const index = state.medicines.findIndex(m => m.id === updated.id)
      if (index !== -1) state.medicines[index] = updated
    }
  },

  actions: {
    // LOAD
    async loadMedicines({ commit }) {
      const db = await dbPromise
      const medicines = await db.getAll('medicines')

      // normalize old data
      const normalized = medicines.map(m => ({
        is_archived: false,
        ...m
      }))

      commit('SET_MEDICINES', normalized)
    },

    // ADD
    async addMedicine({ commit }, medicine) {
      const db = await dbPromise

      const data = {
        ...medicine,
        is_archived: false,
        created_at: new Date(),
        updated_at: new Date()
      }

      const id = await db.add('medicines', data)
      commit('ADD_MEDICINE', { id, ...data })

      // record initial price
      await db.add('price_history', {
        medicine_id: id,
        price1: medicine.price1,
        price2: medicine.price2,
        changed_at: new Date()
      })

      return id
    },

    // UPDATE
    async updateMedicine({ commit }, medicine) {
      const db = await dbPromise

      const current = await db.get('medicines', medicine.id)

      const priceChanged =
        current.price1 !== medicine.price1 ||
        current.price2 !== medicine.price2

      const updated = {
        ...medicine,
        updated_at: new Date()
      }

      await db.put('medicines', updated)
      commit('UPDATE_MEDICINE', updated)

      if (priceChanged) {
        await db.add('price_history', {
          medicine_id: medicine.id,
          price1: medicine.price1,
          price2: medicine.price2,
          changed_at: new Date()
        })
      }
    },

    // ARCHIVE
    async archiveMedicine({ dispatch }, medicine) {
      const db = await dbPromise
      await db.put('medicines', {
        ...medicine,
        is_archived: true,
        updated_at: new Date()
      })
      await dispatch('loadMedicines')
    },

    // RESTORE
    async restoreMedicine({ dispatch }, medicine) {
      const db = await dbPromise
      await db.put('medicines', {
        ...medicine,
        is_archived: false,
        updated_at: new Date()
      })
      await dispatch('loadMedicines')
    }
  }
}
