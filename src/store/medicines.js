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
    async loadMedicines({ commit }) {
      const db = await dbPromise
      const medicines = await db.getAll('medicines')
      console.log('Loaded medicines from IndexedDB:', medicines) 
      commit('SET_MEDICINES', medicines)
    },

    async addMedicine({ commit }, medicine) {
      const db = await dbPromise
      const id = await db.add('medicines', {
        ...medicine,
        created_at: new Date(),
        updated_at: new Date()
      })
      commit('ADD_MEDICINE', { id, ...medicine })

      // Record initial price in price_history
      await db.add('price_history', {
        medicine_id: id,
        price1: medicine.price1,
        price2: medicine.price2,
        changed_at: new Date()
      })

      return id
    },

    async updateMedicine({ commit }, medicine) {
      const db = await dbPromise

      // Get the current record from DB
      const current = await db.get('medicines', medicine.id)

      // Check if price changed
      const priceChanged =
        current.price1 !== medicine.price1 || current.price2 !== medicine.price2

      // Update medicine
      await db.put('medicines', {
        ...medicine,
        updated_at: new Date()
      })
      commit('UPDATE_MEDICINE', medicine)

      // Record price change if any
      if (priceChanged) {
        await db.add('price_history', {
          medicine_id: medicine.id,
          price1: medicine.price1,
          price2: medicine.price2,
          changed_at: new Date()
        })
      }
    }

  }
}
