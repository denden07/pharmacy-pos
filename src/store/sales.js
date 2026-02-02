import { dbPromise } from '../db'
import Swal from 'sweetalert2'

export default {
  namespaced: true,
  state: () => ({
    sales: [],
    lastSaleId: null
  }),

  mutations: {
    SET_SALES(state, sales) {
      state.sales = sales
    },
    SET_LAST_SALE_ID(state, id) {
      state.lastSaleId = id
    }
  },

  actions: {
    // ======================
    // SAVE SALE
    // ======================
    async saveSale({ commit }, payload) {
      const {
        cart,
        subTotal,
        professionalFee,
        discount,
        finalTotal,
        customer_id,
        moneyGiven,
        change,
        purchased_date,

        // Points
        pointsUsed = 0,
        pointsMultiplier = 1,
        pointsDiscount = 0
      } = payload

      if (!cart.length) throw new Error('Cart is empty')

      const db = await dbPromise
      const tx = db.transaction(
        ['sales', 'sale_items', 'inventory_batches', 'points_history', 'yearly_points'],
        'readwrite'
      )

      const salesStore = tx.objectStore('sales')
      const itemsStore = tx.objectStore('sale_items')
      const batchesStore = tx.objectStore('inventory_batches')
      const pointsStore = tx.objectStore('points_history')
      const yearlyStore = tx.objectStore('yearly_points')

      const now = new Date()

      // Save sale
      const saleId = await salesStore.add({
        purchased_date: purchased_date ? new Date(purchased_date) : now,
        created_at: now,
        customer_id: customer_id || null,
        total_amount: subTotal,
        professional_fee: professionalFee,
        discount,
        final_total: finalTotal,
        money_given: moneyGiven,
        change,
        status: 'completed',
        points_used: pointsUsed,
        points_multiplier: pointsMultiplier,
        points_discount: pointsDiscount
      })

      // Deduct inventory
      for (const item of cart) {
        const allBatches = await batchesStore.index('medicine_id').getAll(item.id)
        const availableBatch = allBatches.find(b => b.quantity >= item.qty)
        if (!availableBatch) throw new Error(`Not enough stock for ${item.name}`)

        availableBatch.quantity -= item.qty
        await batchesStore.put(availableBatch)

        await itemsStore.add({
          sale_id: saleId,
          medicine_id: item.id,
          quantity: item.qty,
          price_at_sale: item.price,
          price_type: item.priceType,
          batch_id: availableBatch.id,
          is_piece_or_box: 'piece'
        })
      }

      // Handle points
      if (customer_id) {
        const year = now.getFullYear()
        const yearlyKey = [customer_id, year]

        let yearly = await yearlyStore.get(yearlyKey)
        if (!yearly) yearly = { customer_id, year, points: 0 }

        // Redeem points
        if (pointsUsed > 0) {
          const actualPointsDeducted = pointsUsed * (pointsMultiplier || 1)
          const pointsToDeduct = Math.min(yearly.points, actualPointsDeducted)
          yearly.points -= pointsToDeduct

          await pointsStore.add({
            customer_id,
            date: now,
            type: 'redeem',
            related_sale_id: saleId,
            points: -pointsToDeduct,
            description: `Redeemed ${pointsUsed} points × ${pointsMultiplier} = ${pointsToDeduct}`
          })
        }

        // Earn points
        const pointsEarned = finalTotal / 200
        yearly.points += pointsEarned

        await pointsStore.add({
          customer_id,
          date: now,
          type: 'sale',
          related_sale_id: saleId,
          points: pointsEarned,
          description: `Earned ${pointsEarned.toFixed(2)} points from sale #${saleId}`
        })

        await yearlyStore.put(yearly)
      }

      await tx.done
      commit('SET_LAST_SALE_ID', saleId)
      return saleId
    },

    // ======================
    // LOAD SALES
    // ======================
    async loadSales({ commit }) {
      const db = await dbPromise
      const allSales = await db.getAll('sales')

      const sales = allSales
        .map(s => ({
          ...s,
          purchased_date: new Date(s.purchased_date || s.created_at || new Date()),
          created_at: new Date(s.created_at || new Date()),
          date: new Date(s.date || s.created_at || new Date()),
          status: s.status || 'completed'
        }))
        .sort((a, b) => b.date - a.date)

      commit('SET_SALES', sales)
    },

    // ======================
    // VIEW SALE ITEMS
    // ======================
    async viewSale(_, saleId) {
      const db = await dbPromise
      const tx = db.transaction(['sale_items', 'medicines'])
      const itemsStore = tx.objectStore('sale_items')
      const medsStore = tx.objectStore('medicines')

      const items = await itemsStore.index('sale_id').getAll(saleId)

      for (const item of items) {
        const med = await medsStore.get(item.medicine_id)
        item.medicine_name = med?.name || 'Unknown'
        item.generic_name = med?.generic_name || ''
      }

      return items
    },

    // ======================
    // VOID SALE
    // ======================
    async voidSale({ dispatch }, sale) {
      const result = await Swal.fire({
        title: 'Void Sale?',
        text: 'This will restore inventory, return redeemed points, and remove earned points from this sale.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: 'Yes, void it'
      })
      if (!result.isConfirmed) return

      const db = await dbPromise

      // 1️⃣ Restore inventory
      const items = await db
        .transaction('sale_items')
        .objectStore('sale_items')
        .index('sale_id')
        .getAll(sale.id)

      const invTx = db.transaction('inventory_batches', 'readwrite')
      const batchStore = invTx.objectStore('inventory_batches')

      for (const item of items) {
        if (!item.batch_id) continue
        const batch = await batchStore.get(item.batch_id)
        if (batch) {
          batch.quantity += Number(item.quantity || 0)
          await batchStore.put(batch)
        }
      }
      await invTx.done

      // 2️⃣ Adjust points but do NOT subtract redeemed points
      if (sale.customer_id) {
        const tx = db.transaction(['points_history', 'yearly_points'], 'readwrite')
        const pointsStore = tx.objectStore('points_history')
        const yearlyStore = tx.objectStore('yearly_points')
        const now = new Date()

        const points = await pointsStore.index('related_sale_id').getAll(sale.id)

        const year = new Date().getFullYear()
        const yearlyKey = [sale.customer_id, year]
        const yearly = (await yearlyStore.get(yearlyKey)) || { customer_id: sale.customer_id, year, points: 0 }

        for (const p of points) {
          if (p.type === 'redeem') {
            // ✅ Flip sign to return points
            const returnedPoints = -p.points
            yearly.points += returnedPoints
            await pointsStore.add({
              customer_id: p.customer_id,
              date: now,
              type: 'Redeem Returned',
              related_sale_id: sale.id,
              points: returnedPoints,
              description: `Returned ${Math.abs(returnedPoints)} points from voided sale #${sale.id}`
            })
          } else if (p.type === 'sale') {
            // Remove earned points
            yearly.points -= p.points
            if (yearly.points < 0) yearly.points = 0
            await pointsStore.add({
              customer_id: p.customer_id,
              date: now,
              type: 'Earned Voided',
              related_sale_id: sale.id,
              points: -p.points,
              description: `Removed ${p.points} earned points from voided sale #${sale.id}`
            })
          }
        }

        await yearlyStore.put(yearly)
        await tx.done
      }

      // 3️⃣ Mark sale as voided
      const salesTx = db.transaction('sales', 'readwrite')
      const s = await salesTx.objectStore('sales').get(sale.id)
      if (s) {
        s.status = 'voided'
        await salesTx.objectStore('sales').put(s)
      }
      await salesTx.done

      await dispatch('loadSales')
    },


    // ======================
    // GET MEDICINES MAP
    // ======================
    async getMedicinesMap() {
      const db = await dbPromise
      const medsStore = db.transaction('medicines').objectStore('medicines')
      const allMeds = await medsStore.getAll()
      const map = {}
      allMeds.forEach(med => (map[med.id] = med))
      return map
    }
  }
}
