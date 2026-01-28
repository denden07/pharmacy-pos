<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import Swal from 'sweetalert2'

const store = useStore()

const search = ref('')
const selectedMedicine = ref(null)
const selectedPriceType = ref('regular')

const cart = ref([])
const recentMedicines = ref([])

const professionalFee = ref(0)
const customDiscount = ref(0)
const moneyGiven = ref(0) // Customer money input

/* ======================
   LOAD MEDICINES
====================== */
onMounted(async () => {
  if (!store.state.medicines.medicines.length) {
    await store.dispatch('medicines/loadMedicines')
  }
  await store.dispatch('customers/loadCustomers')

})

const medicines = computed(() => store.state.medicines.medicines || [])

const filteredMedicines = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return []
  return medicines.value.filter(m =>
    m.name.toLowerCase().includes(keyword) ||
    (m.generic_name || '').toLowerCase().includes(keyword)
  )
})

/* ======================
   POS LOGIC
====================== */
const addRecent = (medicine) => {
  recentMedicines.value = [
    medicine,
    ...recentMedicines.value.filter(m => m.id !== medicine.id)
  ].slice(0, 5)
}

const addToCart = (medicine) => {
  const price =
    selectedPriceType.value === 'regular'
      ? medicine.price1
      : medicine.price2

  const existing = cart.value.find(
    i => i.id === medicine.id && i.priceType === selectedPriceType.value
  )

  if (existing) {
    existing.qty += 1
  } else {
    cart.value.push({
      id: medicine.id,
      name: medicine.name,
      generic_name: medicine.generic_name || '',
      priceType: selectedPriceType.value,
      price,
      qty: 1,
    })
  }

  addRecent(medicine)
  selectedMedicine.value = null
  search.value = ''
}

const updatePriceType = (item, type) => {
  item.priceType = type
  const med = medicines.value.find(m => m.id === item.id)
  item.price = type === 'regular' ? med.price1 : med.price2
}

const removeItem = (id) => {
  cart.value = cart.value.filter(i => i.id !== id)
}

/* ======================
   TOTALS
====================== */
const subTotal = computed(() =>
  cart.value.reduce((s, i) => s + i.price * i.qty, 0)
)

const grandTotal = computed(() =>
  Math.max(
    subTotal.value + Number(professionalFee.value) - Number(customDiscount.value),
    0
  )
)

// Money change
const change = computed(() => Math.max(moneyGiven.value - grandTotal.value, 0))

/* ======================
   SAVE SALE
====================== */
const checkout = async () => {
  if (!cart.value.length) {
    Swal.fire({
      icon: 'warning',
      title: 'Empty cart',
      text: 'Please add items before saving the sale.'
    })
    return
  }

  if (moneyGiven.value < grandTotal.value) {
    Swal.fire({
      icon: 'warning',
      title: 'Insufficient payment',
      text: 'Customer money is less than total.'
    })
    return
  }

  const result = await Swal.fire({
    title: 'Confirm Sale',
    html: `
      <p><strong>Subtotal:</strong> ₱${subTotal.value.toFixed(2)}</p>
      <p><strong>Professional Fee:</strong> ₱${professionalFee.value}</p>
      <p><strong>Discount:</strong> ₱${customDiscount.value}</p>
      <p><strong>Money Given:</strong> ₱${moneyGiven.value.toFixed(2)}</p>
      <p><strong>Change:</strong> ₱${change.value.toFixed(2)}</p>
      <hr />
      <h3>Total: ₱${grandTotal.value.toFixed(2)}</h3>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Save Sale',
    cancelButtonText: 'Cancel',
    reverseButtons: true
  })

  if (!result.isConfirmed) return

  try {
    const saleId = await store.dispatch('sales/saveSale', {
      customer_id: selectedCustomer.value?.id || null,
      cart: cart.value,
      subTotal: subTotal.value,
      professionalFee: professionalFee.value,
      discount: customDiscount.value,
      finalTotal: grandTotal.value,
      moneyGiven: moneyGiven.value,  // 🔑 corrected
      change: change.value           // 🔑 corrected
    })

    await Swal.fire({
      icon: 'success',
      title: 'Sale Saved',
      text: `Sale #${saleId} has been saved successfully.`,
      timer: 1500,
      showConfirmButton: false
    })

    // Reset POS
    cart.value = []
    professionalFee.value = 0
    customDiscount.value = 0
    moneyGiven.value = 0
    selectedMedicine.value = null
    selectedCustomer.value = null
  } catch (err) {
    console.error(err)
    Swal.fire({
      icon: 'error',
      title: 'Save failed',
      text: 'Something went wrong while saving the sale.'
    })
  }
}



const showCustomerModal = ref(false)
const customerSearch = ref('')
const selectedCustomer = ref(null)
const newCustomer = ref({ name: '', phone: '', address: '' })

const customers = computed(() => store.state.customers.customers || [])

const filteredCustomers = computed(() => {
  const k = customerSearch.value.toLowerCase()
  return customers.value.filter(c =>
    c.name.toLowerCase().includes(k) ||
    (c.phone || '').includes(k)
  )
})


const selectCustomer = (cust) => {
  selectedCustomer.value = cust
  showCustomerModal.value = false
}

const addCustomer = async () => {
  if (!newCustomer.value.name) return

  const id = await store.dispatch('customers/addCustomer', newCustomer.value)
  const cust = { id, ...newCustomer.value }

  selectedCustomer.value = cust
  newCustomer.value = { name: '', phone: '', address: '' }
  showCustomerModal.value = false
}



</script>

<template>
  <h1>POS System</h1>

  <div class="pos-layout">
    <!-- LEFT: Search & Selection -->
    <section class="pos-left">
      <input
        class="input pos-medicine-search"
        v-model="search"
        placeholder="Search medicine..."
      />

      <!-- Search results -->
      <div
        v-for="med in filteredMedicines"
        :key="med.id"
        class="list-item"
        @click="addToCart(med)"
      >
        <div class="med-name">{{ med.name }}</div>
        <div class="med-generic" v-if="med.generic_name">{{ med.generic_name }}</div>
      </div>

      <!-- Recent -->
      <div v-if="!search && recentMedicines.length" class="list">
        <div class="list-header">
          <strong>Recent</strong>
          <button class="link-btn" @click="recentMedicines = []">Clear</button>
        </div>

        <div
          v-for="med in recentMedicines"
          :key="med.id"
          class="list-item"
          @click="addToCart(med)"
        >
          <div class="med-name">{{ med.name }}</div>
          <div class="med-generic" v-if="med.generic_name">{{ med.generic_name }}</div>
        </div>
      </div>
    </section>

    <!-- RIGHT: Cart & Computation -->
    <section class="pos-right">

      <div class="customer-bar">
        <div v-if="selectedCustomer">
          👤 {{ selectedCustomer.name }}
          <button class="mini danger" @click="selectedCustomer=null">✕</button>
        </div>

        <button class="btn select-customer" @click="showCustomerModal=true">
          Select Customer
        </button>
      </div>
      <h3>Cart</h3>

      <table v-if="cart.length">
        <thead>
          <tr>
            <th>Item</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="item in cart" :key="item.id + item.priceType">
            <td>
              <div class="med-name-table">{{ item.name }}</div>
              <div class="med-generic" v-if="item.generic_name">{{ item.generic_name }}</div>
            </td>

            <td>
              <div class="price-cell">
                <button
                  class="mini regular"
                  :class="{ activePrice: item.priceType === 'regular' }"
                  @click="updatePriceType(item, 'regular')"
                >R</button>
                <button
                  class="mini discounted"
                  :class="{ activePrice: item.priceType === 'discounted' }"
                  @click="updatePriceType(item, 'discounted')"
                >D</button>
                <span>₱{{ item.price }}</span>
              </div>
            </td>

            <td>
              <input class="qty-input-small" type="number" min="1" v-model.number="item.qty" />
            </td>

            <td>₱{{ item.price * item.qty }}</td>

            <td>
              <button class="mini danger" @click="removeItem(item.id)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else>No items</p>

      <div class="totals">
        <label>
          Professional Fee
          <input class="input" type="number" v-model.number="professionalFee" />
        </label>

        <label>
          Discount
          <input class="input" type="number" v-model.number="customDiscount" />
        </label>

        <label>
          Money Given
          <input class="input" type="number" v-model.number="moneyGiven" />
        </label>
        <p><strong>Change:</strong> ₱{{ change.toFixed(2) }}</p>

        <h2>Total: ₱{{ grandTotal }}</h2>

        <button class="btn checkout" @click="checkout">
          Save Sale
        </button>
      </div>
    </section>

    <div v-if="showCustomerModal" class="modal-backdrop">
      <div class="modal">
        <h3>Select Customer</h3>

        <!-- Search input -->
        <input
          class="input pos-medicine-search"
          v-model="customerSearch"
          placeholder="Search customer..."
        />

        <!-- Search results (only show if there is input) -->
        <div v-if="customerSearch && filteredCustomers.length" class="list">
          <div
            v-for="c in filteredCustomers"
            :key="c.id"
            class="list-item"
            @click="selectCustomer(c)"
          >
            <div class="med-name">{{ c.name }}</div>
            <div class="med-generic" v-if="c.phone || c.address">
              {{ c.phone }} <span v-if="c.address">- {{ c.address }}</span>
            </div>
          </div>
        </div>

        <hr />

        <h4>Add New Customer</h4>

        <div class="new-customer-form">
          <label>
            Name
            <input class="input" v-model="newCustomer.name" placeholder="Customer Name" />
          </label>

          <label>
            Phone
            <input class="input" v-model="newCustomer.phone" placeholder="Phone Number" />
          </label>

          <label>
            Address
            <input class="input" v-model="newCustomer.address" placeholder="Address" />
          </label>
        </div>

        <div class="modal-actions">
          <button class="btn checkout" @click="addCustomer">Save</button>
          <button class="btn danger" @click="showCustomerModal=false">Cancel</button>
        </div>
      </div>
    </div>

    
  </div>
</template>

<style scoped>
/* =========================
   POS LAYOUT
========================= */
.pos-layout {
  display: grid;
  grid-template-columns: 1fr 2.3fr; /* 30% / 70% */
  gap: 24px;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

@media (max-width: 900px) {
  .pos-layout {
    grid-template-columns: 1fr;
  }
}

/* =========================
   LEFT SECTION
========================= */
.pos-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}

/* Search input fixed */
.pos-medicine-search {
  width: 100%;
  padding: 0 12px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid #444;
  font-size: 15px;
  color: #222;
  background-color: #fff;
  box-sizing: border-box;
}

body.dark-mode .pos-medicine-search {
  background-color: #1c1c1c;
  border-color: #333;
  color: #eee;
}

.pos-medicine-search::placeholder { color: #666; }
body.dark-mode .pos-medicine-search::placeholder { color: #aaa; }

/* =========================
   RECENT LIST & SEARCH RESULTS
========================= */
.list {
  max-height: 220px;
  overflow-y: auto;
}

.list-item {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
  margin-bottom: 6px;
  cursor: pointer;
  background: #fdfdfd;
  box-sizing: border-box;
}

body.dark-mode .list-item {
  background: #1c1c1c;
  border-color: #333;
}

.list-header { display: flex; justify-content: space-between; font-weight: 600; }
.link-btn { background: none; border: none; color: #e74c3c; cursor: pointer; }

/* =========================
   CART / RIGHT SECTION
========================= */
.pos-right {
  border-left: 1px solid #ddd;
  padding-left: 20px;
  width: 100%;
  box-sizing: border-box;
}

body.dark-mode .pos-right { border-color: #333; }

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  table-layout: fixed;
  word-wrap: break-word;
}

th, td { padding: 10px; border: 1px solid #ccc; }
body.dark-mode th, body.dark-mode td { border-color: #333; }

.price-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.mini {
  height: 28px;
  min-width: 28px;
  border-radius: 6px;
  border: none;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.mini.regular { background: #1abc9c; }
.mini.discounted { background: #3498db; }
.mini.danger,.btn.danger { background: #e74c3c; }

/* Active price highlight */
.activePrice {
  outline: 2px solid #1c1c1c;
  box-shadow: 0 0 5px #1c1c1c;
}

/* =========================
   TOTALS & INPUTS
========================= */
.totals {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}

.totals label {
  display: flex;
  flex-direction: column;
  font-weight: 600;
}

.totals input {
  height: 48px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid #444;
  font-size: 16px;
  font-weight: 500;
  color: #222;
  background-color: #fff;
  box-sizing: border-box;
}

body.dark-mode .totals input {
  background-color: #1c1c1c;
  border-color: #333;
  color: #eee;
}

.totals input::placeholder { color: #666; }
body.dark-mode .totals input::placeholder { color: #aaa; }

/* Save Sale button green */
.btn.checkout {
  background-color: #28a745;
  color: #fff;
  height: 48px;
  border-radius: 10px;
  font-weight: 600;
}

/* =========================
   INPUTS - SMALL QTY
========================= */
.qty-input-small {
  height: 32px;
  width: 60px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid #444;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  background-color: #fff;
  color: #222;
  box-sizing: border-box;
}

body.dark-mode .qty-input-small {
  background-color: #1c1c1c;
  border-color: #333;
  color: #eee;
}

/* =========================
   MEDICINE NAME
========================= */
.med-name-table { font-weight: 700; font-size: 16px; }
.med-generic { font-size: 13px; color: #666; }
body.dark-mode .med-generic { color: #aaa; }

.customer-bar {
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:12px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  padding: 20px;
  border-radius: 12px;
  width: 400px;
  max-height: 80vh;
  overflow-y: auto;
  box-sizing: border-box;
}

body.dark-mode .modal {
  background: #1c1c1c;
  color: #eee;
}

.new-customer-form label {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
  font-weight: 600;
}

.new-customer-form .input {
  height: 40px;
  border-radius: 8px;
  border: 1px solid #444;
  padding: 0 12px;
  font-size: 14px;
  background-color: #fff;
  color: #222;
  box-sizing: border-box;
}

body.dark-mode .new-customer-form .input {
  background-color: #1c1c1c;
  border-color: #333;
  color: #eee;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}

/* Select Customer button */
.btn.select-customer {
  background-color: #3498db; /* blue */
  color: #fff;
  border: none;
  height: 44px;
  padding: 0 18px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

.btn.select-customer:hover {
  background-color: #2980b9;
}

.btn.select-customer:active {
  transform: scale(0.98);
}



</style>
