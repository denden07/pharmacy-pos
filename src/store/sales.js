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

        // 🔹 NEW
        pointsUsed = 0,
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

        // 🔹 NEW
        points_used: pointsUsed,
        points_discount: pointsDiscount
      })

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

      if (customer_id) {
        const year = now.getFullYear()
        const yearlyKey = [customer_id, year]
        const yearly = (await yearlyStore.get(yearlyKey)) || { customer_id, year, points: 0 }

        // 🔹 Redeem
        if (pointsUsed > 0) {
          yearly.points -= pointsUsed
          if (yearly.points < 0) yearly.points = 0

          await pointsStore.add({
            customer_id,
            date: now,
            type: 'redeem',
            related_sale_id: saleId,
            points: -pointsUsed,
            description: `Redeemed ${pointsUsed} points for ₱${pointsDiscount}`
          })
        }

        // 🔹 Earn
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
    // SAVE EDITED SALE
    // ======================
    async saveEdit(_, { sale, items }) {
      const db = await dbPromise
      const tx = db.transaction(
        ['sales', 'sale_items', 'inventory_batches', 'points_history', 'yearly_points'],
        'readwrite'
      )

      const salesStore = tx.objectStore('sales')
      const itemsStore = tx.objectStore('sale_items')
      const batchStore = tx.objectStore('inventory_batches')
      const pointsStore = tx.objectStore('points_history')
      const yearlyStore = tx.objectStore('yearly_points')

      const now = new Date()

      const oldItems = await itemsStore.index('sale_id').getAll(sale.id)
      for (const old of oldItems) {
        if (!old.batch_id) continue
        const batch = await batchStore.get(old.batch_id)
        if (batch) {
          batch.quantity += Number(old.quantity)
          await batchStore.put(batch)
        }
        await itemsStore.delete(old.id)
      }

      if (sale.customer_id) {
        const oldPoints = await pointsStore.index('related_sale_id').getAll(sale.id)
        for (const p of oldPoints) {
          const year = new Date(p.date).getFullYear()
          const yearlyKey = [p.customer_id, year]
          const yearly = await yearlyStore.get(yearlyKey)
          if (yearly) {
            yearly.points -= p.points
            if (yearly.points < 0) yearly.points = 0
            await yearlyStore.put(yearly)
          }
          await pointsStore.delete(p.id)
        }
      }

      await salesStore.put({
        ...sale,
        purchased_date: sale.purchased_date ? new Date(sale.purchased_date) : now,
        created_at: sale.created_at ? new Date(sale.created_at) : now,
        date: new Date(sale.date || now)
      })

      for (const item of items) {
        const batches = await batchStore.index('medicine_id').getAll(item.medicine_id)
        const batch = batches.find(b => b.quantity >= item.qty)
        if (!batch) throw new Error(`Not enough stock for ${item.medicine_name}`)

        batch.quantity -= Number(item.qty)
        await batchStore.put(batch)

        await itemsStore.add({
          sale_id: sale.id,
          medicine_id: item.medicine_id,
          quantity: Number(item.qty),
          price_at_sale: Number(item.price),
          price_type: item.price_mode,
          batch_id: batch.id,
          is_piece_or_box: 'piece'
        })
      }

      if (sale.customer_id) {
        const pointsEarned = sale.final_total / 200
        await pointsStore.add({
          customer_id: sale.customer_id,
          date: now,
          type: 'sale',
          related_sale_id: sale.id,
          points: pointsEarned,
          description: `Earned ${pointsEarned.toFixed(2)} points from sale #${sale.id}`
        })

        const year = now.getFullYear()
        const yearlyKey = [sale.customer_id, year]
        const existing = await yearlyStore.get(yearlyKey)
        if (existing) {
          existing.points += pointsEarned
          await yearlyStore.put(existing)
        } else {
          await yearlyStore.add({
            customer_id: sale.customer_id,
            year,
            points: pointsEarned
          })
        }
      }

      await tx.done
    },

    // ======================
    // VOID SALE (RESTORE)
    // ======================
    async voidSale({ dispatch }, sale) {
      const result = await Swal.fire({
        title: 'Void Sale?',
        text: 'This will restore inventory, remove points, and mark the sale as voided.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: 'Yes, void it'
      })
      if (!result.isConfirmed) return

      const db = await dbPromise

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

      if (sale.customer_id) {
        const tx = db.transaction(['points_history', 'yearly_points'], 'readwrite')
        const pointsStore = tx.objectStore('points_history')
        const yearlyStore = tx.objectStore('yearly_points')

        const points = await pointsStore.index('related_sale_id').getAll(sale.id)
        for (const p of points) {
          const year = new Date(p.date).getFullYear()
          const yearlyKey = [p.customer_id, year]
          const yearly = await yearlyStore.get(yearlyKey)
          if (yearly) {
            yearly.points -= p.points
            if (yearly.points < 0) yearly.points = 0
            await yearlyStore.put(yearly)
          }
          await pointsStore.delete(p.id)
        }
        await tx.done
      }

      const salesTx = db.transaction('sales', 'readwrite')
      const s = await salesTx.objectStore('sales').get(sale.id)
      if (s) {
        s.status = 'voided'
        await salesTx.objectStore('sales').put(s)
      }
      await salesTx.done

      await dispatch('loadSales')
    },

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
