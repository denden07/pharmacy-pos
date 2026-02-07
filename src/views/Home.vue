<script setup>
import { ref, computed, watch } from 'vue'
import { useStore } from 'vuex'
import Swal from 'sweetalert2'
import { dbPromise } from '../db'

const store = useStore()

// ======================
// POS STATE
// ======================
const search = ref('')
const selectedMedicine = ref(null)
const selectedPriceType = ref('regular')
const cart = ref([])
const professionalFee = ref(0)
const moneyGiven = ref(0)
const selectedCustomer = ref(null)
const showCustomerModal = ref(false)
const customerSearch = ref('')
const newCustomer = ref({ name: '', phone: '', address: '' })

// ======================
// REDEEM POINTS
// ======================
const showRedeemModal = ref(false)
const customerPoints = ref(0)
const redeemMultiplier = ref(1)
const pointsConfirmed = ref(false)

const pointsUsed = computed(() => pointsConfirmed.value ? customerPoints.value * redeemMultiplier.value : 0)
const pointsDiscount = computed(() => pointsUsed.value)

// ======================
// Focus tracking for number pad
// ======================
const focusedItem = ref(null)
const focusedField = ref('')
const setActiveInput = (item, field) => {
  focusedItem.value = item
  focusedField.value = field
}

const paymentMethod = ref('cash') // default

// ======================
// NUMBER PAD
// ======================
const appendNumber = (num) => {
  if (!focusedField.value) return

  if (focusedField.value === 'qty' && focusedItem.value) {
    focusedItem.value.qty = Number(String(focusedItem.value.qty) + num)
  } else if (focusedField.value === 'professionalFee') {
    professionalFee.value = Number(String(professionalFee.value) + num)
  } else if (focusedField.value === 'moneyGiven') {
    moneyGiven.value = Number(String(moneyGiven.value) + num)
  }
}

const backspace = () => {
  if (!focusedField.value) return

  if (focusedField.value === 'qty' && focusedItem.value) {
    focusedItem.value.qty = Number(String(focusedItem.value.qty).slice(0, -1) || 0)
  } else if (focusedField.value === 'professionalFee') {
    professionalFee.value = Number(String(professionalFee.value).slice(0, -1) || 0)
  } else if (focusedField.value === 'moneyGiven') {
    moneyGiven.value = Number(String(moneyGiven.value).slice(0, -1) || 0)
  }
}

const clearInput = () => {
  if (!focusedField.value) return

  if (focusedField.value === 'qty' && focusedItem.value) focusedItem.value.qty = 1
  else if (focusedField.value === 'professionalFee') professionalFee.value = 0
  else if (focusedField.value === 'moneyGiven') moneyGiven.value = 0
}

// ======================
// MEDICINES SEARCH (WITH LATEST PRICE)
// ======================
// ======================
// MASTER MEDICINES CACHE
// ======================
const medicinesMap = ref({}) // id => medicine object
let filteredMedicines = ref ({})

watch(search, async (val) => {
  const q = val.trim().toLowerCase()
  if (!q) {
    filteredMedicines.value = []
    return
  }

  const db = await dbPromise
  const meds = await db.getAll('medicines')
  const batches = await db.getAll('inventory_batches')

  const matches = meds.filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.generic_name || '').toLowerCase().includes(q)
  )

  for (const m of matches) {
    const medBatches = batches.filter(b => b.medicine_id === m.id)
    const totalStock = medBatches.reduce((sum, b) => sum + (b.quantity || 0), 0)

    m.quantity = totalStock
    m.stockIndicator = getStockIndicator({ quantity: totalStock })
    medicinesMap.value[m.id] = m
  }

  filteredMedicines.value = matches
})

// ======================
// CUSTOMERS SEARCH (ACCURATE POINTS)
// ======================
const filteredCustomers = ref([])

watch(customerSearch, async (val) => {
  const q = val.trim().toLowerCase()
  if (!q) {
    filteredCustomers.value = []
    return
  }

  const db = await dbPromise
  const customers = await db.getAll('customers')

  const matches = customers.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.phone || '').includes(q)
  )

  const year = new Date().getFullYear()
  const yearlyStore = db.transaction('yearly_points').objectStore('yearly_points')

  for (const c of matches) {
    const yearly = await yearlyStore.get([c.id, year])
    c.points = yearly?.points || 0
  }

  filteredCustomers.value = matches
})

// ======================
// CART LOGIC
// ======================
const addToCart = (med) => {
  const price = selectedPriceType.value === 'regular'
    ? med.price1
    : med.price2

  const existing = cart.value.find(i => i.id === med.id && i.priceType === selectedPriceType.value)

  if (existing) existing.qty += 1
  else cart.value.push({
    id: med.id,
    name: med.name,
    generic_name: med.generic_name || '',
    priceType: selectedPriceType.value,
    price,
    qty: 1
  })

  search.value = ''
  filteredMedicines.value = []
}


const setPriceType = (item, type) => {
  const med = medicinesMap.value[item.id] // <-- always the original med
  if (!med) return
  item.priceType = type
  item.price = type === 'regular' ? med.price1 : med.price2
}


const removeItem = (id) => {
  cart.value = cart.value.filter(i => i.id !== id)
}


const getPrice = (medId, type) => {
  const med = filteredMedicines.value.find(m => m.id === medId) || cart.value.find(m => m.id === medId)
  if (!med) return '0.00'
  const price = type === 'regular' 
    ? Number(med.price1 || 0) 
    : Number(med.price2 || med.price1 || 0)
  return price.toFixed(2)
}


// ======================
// TOTALS
// ======================
const subTotal = computed(() => cart.value.reduce((sum, i) => sum + i.price * i.qty, 0))
const grandTotal = computed(() => Math.max(subTotal.value + Number(professionalFee.value || 0) - Number(pointsDiscount.value || 0), 0))
const change = computed(() => Math.max((moneyGiven.value || 0) - grandTotal.value, 0))

// ======================
// REDEEM FLOW
// ======================
const openRedeemModal = () => {
  if (!selectedCustomer.value) return Swal.fire('Select customer first')
  redeemMultiplier.value = 1
  showRedeemModal.value = true
}

const confirmPoints = () => {
  pointsConfirmed.value = true
  showRedeemModal.value = false
}

const removePoints = () => {
  pointsConfirmed.value = false
  redeemMultiplier.value = 1
}

// ======================
// CHECKOUT & SAVE SALE
// ======================
const checkout = async () => {
  if (!cart.value.length)
    return Swal.fire({
      icon: 'warning',
      title: 'Empty cart',
      text: 'Please add items before saving the sale.'
    })

  if ((moneyGiven.value || 0) < grandTotal.value)
    return Swal.fire({
      icon: 'warning',
      title: 'Insufficient payment',
      text: 'Customer money is less than total.'
    })

  // Optional: check stock and warn
  const lowStockItems = cart.value.filter(item => (medicinesMap.value[item.id]?.quantity || 0) <= 0)
  if (lowStockItems.length) {
    await Swal.fire({
      icon: 'warning',
      title: 'Warning',
      html: `Some items have no stock:<br/>${lowStockItems.map(i => i.name).join(', ')}<br/>You can still proceed with the sale.`,
      confirmButtonText: 'Proceed Anyway'
    })
  }

  // Confirmation
  const confirmResult = await Swal.fire({
    title: 'Confirm Checkout',
    html: `Total: ₱${grandTotal.value.toFixed(2)}<br/>
           Money Given: ₱${moneyGiven.value.toFixed(2)}<br/>
           Change: ₱${change.value.toFixed(2)}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, Save Sale',
    cancelButtonText: 'Cancel',
  })

  if (!confirmResult.isConfirmed) return

  try {
    const saleId = await store.dispatch('sales/saveSale', {
      cart: cart.value,
      subTotal: subTotal.value,
      professionalFee: professionalFee.value,
      discount: pointsDiscount.value,
      finalTotal: grandTotal.value,
      customer_id: selectedCustomer.value?.id || null,
      moneyGiven: moneyGiven.value,
      change: change.value,
      purchased_date: new Date().toISOString(),

      // Points
      pointsUsed: pointsUsed.value,
      pointsMultiplier: redeemMultiplier.value,
      pointsDiscount: pointsDiscount.value,
      payment_method: paymentMethod.value,
    })

    Swal.fire({
      icon: 'success',
      title: 'Sale Completed',
      text: `Sale #${saleId} saved`,
      timer: 1500,
      showConfirmButton: false
    })

    // Reset POS
    cart.value = []
    professionalFee.value = 0
    moneyGiven.value = 0
    selectedCustomer.value = null
    customerPoints.value = 0
    redeemMultiplier.value = 1
    pointsConfirmed.value = false

  } catch (err) {
    console.error(err)
    Swal.fire({ icon: 'error', title: 'Checkout Failed', text: err.message || 'Something went wrong.' })
  }
}


// ======================
// SELECT CUSTOMER
// ======================
const selectCustomer = async (cust) => {
  const db = await dbPromise

  // load full customer
  const fullCustomer = await db.get('customers', cust.id)
  selectedCustomer.value = fullCustomer
  showCustomerModal.value = false

  const year = new Date().getFullYear()

  // 🔁 READ ONLY FROM yearly_points (single source of truth)
  const yearly = await db
    .transaction('yearly_points')
    .objectStore('yearly_points')
    .get([cust.id, year])

  customerPoints.value = yearly?.points || 0

  redeemMultiplier.value = 1
  pointsConfirmed.value = false
}


// ======================
// ADD CUSTOMER
// ======================
const addCustomer = async () => {
  if (!newCustomer.value.name) return

  const id = await store.dispatch('customers/addCustomer', newCustomer.value)
  selectedCustomer.value = { id, ...newCustomer.value }

  customerPoints.value = 0
  redeemMultiplier.value = 1
  pointsConfirmed.value = false

  newCustomer.value = { name:'', phone:'', address:'' }
  showCustomerModal.value = false
}

const getStockIndicator = (med) => {
  if (!med.quantity || med.quantity <= 0) {
    return { icon: '▲!', color: 'red', text: 'Out of stock', quantity: 0 }
  } else if (med.quantity < 10) {
    return { icon: '▲', color: 'orange', text: `Low stock: ${med.quantity}`, quantity: med.quantity }
  } else {
    return { icon: '', color: 'green', text: `Stock: ${med.quantity}`, quantity: med.quantity }
  }
}


</script>

<template>
<h1 style="font-size: 32px;">Calculator</h1>

<!-- SEARCH BAR + CUSTOMER BUTTON -->
<div class="search-bar">
  <input class="input pos-medicine-search" v-model="search" placeholder="Search medicine..." />
  <button class="btn select-customer" @click="showCustomerModal=true">Select Customer</button>

  <!-- Dropdown -->
<div v-if="search && filteredMedicines.length" class="dropdown">
  <div v-for="med in filteredMedicines" :key="med.id" class="dropdown-item" @click="addToCart(med)">
    <div class="dropdown-item-content">
      <div>
        <div class="med-name">{{ med.name }}</div>
        <div class="med-generic" v-if="med.generic_name">{{ med.generic_name }}</div>
      </div>

      <!-- Stock indicator -->
      <div 
        class="stock-indicator" 
        :title="med.stockIndicator.text"
        :class="{
          'out-of-stock': med.quantity <= 0,
          'low-stock': med.quantity > 0 && med.quantity < 10,
          'normal-stock': med.quantity >= 10
        }"
      >
        <!-- <span>{{ med.stockIndicator.icon }}</span> -->
        <span>Remaining QTY:  {{ med.quantity }}</span>
      </div>
    </div>
  </div>
</div>


</div>

<!-- Selected Customer Badge + Redeem Buttons -->
<div style="display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    justify-content: center;
    margin-bottom: 16px;">
  <div style="display:flex;align-items:center;gap:10px;">
    <strong>Sold to:</strong> 
    <span v-if="selectedCustomer" class="selected-customer">
      👤 {{ selectedCustomer.name }}
      <small v-if="selectedCustomer.address">({{ selectedCustomer.address }})</small>
    </span>
    <button v-if="selectedCustomer" class="mini danger" @click="selectedCustomer=null">✕</button>
  </div>

  <!-- Redeem / Remove Points -->
  <div v-if="selectedCustomer" style="display:flex; gap:4px;">
    <button 
      v-if="!pointsConfirmed" 
      class="mini regular" 
      @click="openRedeemModal"
    >
      🎁 Redeem Points
    </button>

    <button 
      v-if="pointsConfirmed" 
      class="mini danger" 
      @click="removePoints"
    >
      Remove Points
    </button>
  </div>
</div>



<div class="pos-layout">
  <!-- CENTER: CART -->
  <div class="cart-wrapper">
    <div class="cart-table-container">
      <table v-if="cart.length">
        <thead>
          <tr>
            <th width="25%">Medicine</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in cart" :key="item.id">
            <td>
              <div class="med-name-table">{{ item.name }}</div>
              <div class="med-generic" v-if="item.generic_name">{{ item.generic_name }}</div>
            </td>
            <td>
<div class="price-toggle">
  <button
    :class="{ active: item.priceType === 'regular', inactive: item.priceType !== 'regular' }"
    @click="setPriceType(item, 'regular')"
  >
    Reg ₱{{ medicinesMap[item.id]?.price1.toFixed(2) || '0.00' }}
  </button>

  <button
    :class="{ active: item.priceType === 'discount', inactive: item.priceType !== 'discount' }"
    @click="setPriceType(item, 'discount')"
  >
    Dis ₱{{ medicinesMap[item.id]?.price2.toFixed(2) || '0.00' }}
  </button>
</div>

            </td>
            <td>
              <div class="qty-wrapper">
                <button @click="item.qty = Math.max(1,item.qty-1)">-</button>
                <input
                  style="font-weight: bold"
                  type="number"
                  :value="item.qty"
                  readonly
                  @click="setActiveInput(item,'qty')"
                  :class="{ 'active-input': focusedField==='qty' && focusedItem===item }"
                />
                <button @click="item.qty += 1">+</button>
              </div>
            </td>
            <td>₱{{ (item.price * item.qty).toFixed(2) }}</td>
            <td>
              <button class="mini danger button-remove-med" @click="removeItem(item.id)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else>No items</p>
    </div>

    <!-- Totals -->
    <div class="cart-totals">
      <div>
        <span>Subtotal</span>
        <strong>₱{{ subTotal.toFixed(2) }}</strong>
      </div>

      <div>
        <span>Discount</span>
        <strong>-₱{{ pointsDiscount }}</strong>
      </div>

      <div class="grand">
        <span><strong>Grand Total</strong></span>
        <strong>₱{{ grandTotal.toFixed(2) }}</strong>
      </div>

      <div class="change">
        <span><strong>Change</strong></span>
        <strong>₱{{ change.toFixed(2) }}</strong>
      </div>
    </div>

  </div>

  <!-- RIGHT PANEL -->
  <div class="right-panel">
    <label>
      Professional Fee
      <input
        type="number"
        :value="professionalFee"
        readonly
        @click="setActiveInput(null,'professionalFee')"
        :class="{ 'active-input': focusedField==='professionalFee' }"
      />
    </label>

    <label>
      Money Given
      <input
        type="number"
        :value="moneyGiven"
        readonly
        @click="setActiveInput(null,'moneyGiven')"
        :class="{ 'active-input': focusedField==='moneyGiven' }"
      />
    </label>

    <!-- Number Pad -->
    <div class="number-pad">
      <button class="num-btn" @click="appendNumber(1)">1</button>
      <button class="num-btn" @click="appendNumber(2)">2</button>
      <button class="num-btn" @click="appendNumber(3)">3</button>
      <button class="num-btn" @click="appendNumber(4)">4</button>
      <button class="num-btn" @click="appendNumber(5)">5</button>
      <button class="num-btn" @click="appendNumber(6)">6</button>
      <button class="num-btn" @click="appendNumber(7)">7</button>
      <button class="num-btn" @click="appendNumber(8)">8</button>
      <button class="num-btn" @click="appendNumber(9)">9</button>
      <button class="num-btn" @click="clearInput">C</button>
      <button class="num-btn" @click="appendNumber(0)">0</button>
      <button class="num-btn" @click="backspace">←</button>
    </div>

    <div class="payment-toggle">
      <button
        :class="{ active: paymentMethod === 'cash' }"
        @click="paymentMethod = 'cash'"
      >
        💵 Cash
      </button>

      <button
        :class="{ active: paymentMethod === 'gcash' }"
        @click="paymentMethod = 'gcash'"
      >
        📱 GCash
      </button>
    </div>


    <button class="btn checkout" @click="checkout">Save Sale</button>
  </div>
</div>

<!-- CUSTOMER MODAL -->
<div v-if="showCustomerModal" class="modal-backdrop">
  <div class="modal modal-customer">
    <h3>Select Customer</h3>

    <input
      class="input pos-medicine-search"
      v-model="customerSearch"
      placeholder="Search customer..."
    />

    <div v-if="customerSearch && filteredCustomers.length" class="customer-list">
      <div
        v-for="c in filteredCustomers"
        :key="c.id"
        class="customer-row"
        @click="selectCustomer(c)"
      >
        <strong>{{ c.name }}</strong>
        <small>{{ c.address }}</small>
      </div>
    </div>

    <hr/>
    <h4>Add New Customer</h4>
    <div class="new-customer-form">
      <label>Name<input class="input" v-model="newCustomer.name" /></label>
      <label>Address<input class="input" v-model="newCustomer.address" /></label>
      <label>Phone<input class="input" v-model="newCustomer.phone" /></label>
    </div>

    <div class="modal-actions">
      <button class="btn checkout" @click="addCustomer">Save</button>
      <button class="btn danger" @click="showCustomerModal=false">Cancel</button>
    </div>
  </div>
</div>

<!-- REDEEM MODAL -->
<div v-if="showRedeemModal" class="modal-backdrop">
  <div class="modal">
    <h3>Redeem Points</h3>
    <p>Available: <strong>{{ customerPoints }}</strong></p>

    <div class="qty-wrapper">
      <button @click="redeemMultiplier = Math.max(1, redeemMultiplier - 1)">-</button>
      <input type="number" :value="redeemMultiplier" readonly />
      <button @click="redeemMultiplier += 1">+</button>
    </div>

    <p>
      Discount: <strong>₱{{ redeemMultiplier * customerPoints }}</strong>
    </p>

    <div class="modal-actions">
      <button class="btn checkout" @click="confirmPoints">Apply</button>
      <button class="btn danger" @click="showRedeemModal=false">Cancel</button>
    </div>
  </div>
</div>
</template>

<style scoped>
  /* =========================
   SEARCH BAR
========================= */
.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  position: relative;
}
.input.pos-medicine-search {
  flex: 1;
  height: 44px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 15px;
  background: #fff;
  color: #222;
}
.btn.select-customer {
  background: #3498db;
  color: #fff;
  border: none;
  border-radius: 8px;
  height: 44px;
  padding: 0 14px;
  cursor: pointer;
}

/* Dropdown */
.dropdown {
  position: absolute;
  top: 46px;
  left: 0;
  width: 100%;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 8px;
  max-height: 220px;
  overflow-y: auto;
  z-index: 100;
}
.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  border: 1px solid lightgrey;
}
.dropdown-item:hover {
  background: #f0f8ff;
}

/* =========================
   MAIN LAYOUT
========================= */
.pos-layout {
  display: flex;
  gap: 14px;
  min-height: 500px;
}

/* =========================
   CART WRAPPER
========================= */
.cart-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid #ccc;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

/* Scrollable table container with max 5 rows visible */
.cart-table-container {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  max-height: calc(5 * 48px + 40px); /* 5 rows + header */
}

/* Optional scroll indicator styling */
.cart-table-container::-webkit-scrollbar {
  width: 8px;
}
.cart-table-container::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0.25);
  border-radius: 4px;
}
.cart-table-container::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.05);
  border-radius: 4px;
}

table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 8px;
  border-bottom: 1px solid #ddd;
  text-align: center;
}

/* Totals below table */
.cart-totals {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0px 12px;
  padding: 10px;
  border-top: 1px solid #ccc;
  background: #f9f9f9;
  font-size: 18px;
  text-align: center;
  margin-top: auto
}

.cart-totals div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cart-totals span {
  font-size: 13px;
  color: #555;
}

.cart-totals strong {
  font-size: 20px;
  font-weight: 700;
}

/* Emphasis */
.cart-totals .grand strong {
  color: #28a745; /* GREEN */
  font-size: 26px;
}

.cart-totals .change strong {
  color: #e74c3c; /* RED */
  font-size: 26px;
}


/* =========================
   RIGHT PANEL
========================= */
.right-panel {
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #f9f9f9;
  border: 1px solid #ccc;
  border-radius: 10px;
  padding: 10px;
}
.right-panel label {
  display: flex;
  flex-direction: column;
  font-size: 14px;
  font-weight: 600;
}
.right-panel input {
  height: 36px;
  border-radius: 6px;
  border: 1px solid #ccc;
  padding: 0 10px;
  font-size: 14px;
  background: #fff;
  color: #222;
}
.right-panel input:focus {
  outline: 2px solid #3498db;
}

/* =========================
   NUMBER PAD
========================= */
.number-pad {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 4px;
}
.num-btn {
  height: 36px;
  border-radius: 6px;
  border: none;
  background: #3498db;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
.num-btn:active {
  transform: scale(0.95);
}
.btn.checkout {
  margin-top: 6px;
  background: #28a745;
  color: #fff;
  border-radius: 8px;
  height: 38px;
}

/* =========================
   QTY CONTROLS
========================= */
.qty-wrapper {
  display: flex;
  gap: 6px;
  justify-content: center;
  align-items: center;
}
.qty-wrapper input {
  width: 50px;
  height: 36px;
  text-align: center;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #fff;
  color: #222;
}
.qty-wrapper button {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: #3498db;
  color: #fff;
  font-size: 13px;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* =========================
   PRICE BUTTONS
========================= */
.price-cell {
  display: flex;
  gap: 6px;
  justify-content: center;
}
.price-cell .mini {
  padding: 4px 8px;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  font-weight: 600;
  color: #fff;
  min-width: 70px;
}
.price-cell .mini.regular { background:#3498db; }
.price-cell .mini.discounted { background:#2980b9; }
.price-cell .mini.activePrice {
  background: #28a745;
  border: 2px solid #000;
}

.mini.danger {
  background: red;
  color: #ffff;
}


.mini.regular {
  background: #2980b9 !important;
  color: #ffff !important
}


/* =========================
   SELECTED CUSTOMER BADGE
========================= */
.selected-customer {
  padding: 6px 10px;
  border-radius: 8px;
  background: #e6f7ff;
  border: 1px solid #3498db;
  font-size: 16px;
  margin-top: 6px;
}

/* =========================
   CUSTOMER MODAL
========================= */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.6);
  display:flex;
  justify-content:center;
  align-items:center;
  z-index:1000;
}
.modal {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  width: 380px;
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.modal input {
  height: 36px;
  border-radius: 6px;
  border: 1px solid #ccc;
  padding: 0 10px;
  background: #fff;
  color: #222;
}
.customer-list {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.customer-row {
  padding: 8px;
  cursor: pointer;
  border-bottom: 1px solid #ddd;
}
.customer-row:hover { background: #f0f8ff; }

/* =========================
   MED NAMES
========================= */
.med-name { font-size: 20px;}
.med-name-table { font-weight:700; }
.med-generic { font-size:16px; color:#888; }

/* =========================
   DARK MODE
========================= */
.dark .search-bar input,
.dark .cart-wrapper,
.dark .right-panel,
.dark .modal {
  background: #1e1e1e;
  color: #f1f1f1;
  border-color: #333;
}
.dark .right-panel input,
.dark .qty-wrapper input,
.dark .modal input {
  background: #333;
  color: #f1f1f1;
  border-color: #555;
}
.dark .num-btn,
.dark .qty-wrapper button,
.dark .price-cell .mini.regular,
.dark .price-cell .mini.discounted {
  background: #4da3ff;
}
.dark .price-cell .mini.activePrice {
  background: #2ecc71;
  border-color: #fff;
}
.dark .dropdown-item:hover,
.dark .customer-row:hover {
  background: #222;
}

/* =========================
   CUSTOMER MODAL FIX
========================= */

/* Force consistent layout */
.modal h3, .modal h4 {
  margin: 0;
  text-align: center;
}

.new-customer-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Make all modal inputs equal width */
.modal .input,
.modal input {
  width: 100%;
  height: 44px;
  border-radius: 10px;
  border: 1px solid #ccc;
  padding: 0 14px;
  font-size: 15px;
  background: #fff;
  color: #222;
  box-sizing: border-box;
}

/* Labels stack cleanly */
.new-customer-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #444;
}

/* Customer search field */
.modal .pos-medicine-search {
  width: 100%;
  height: 44px;
  font-size: 15px;
  padding: 0 14px;
  border-radius: 10px;
  box-sizing: border-box;
}

/* Modal buttons aligned */
.modal-actions {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}
.modal-actions .btn {
  flex: 1;
  height: 44px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-actions .btn.checkout,
.modal-actions .btn.danger {
  width: 100%;
}

/* Customer rows cleaner */
.customer-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Prevent flex shrink in modal */
.modal > * {
  flex-shrink: 0;
}

.modal-customer {
  display: block;
}

.price-toggle {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.price-toggle button.active {
  background-color: green;
  color: white;
}

.price-toggle button.inactive {
  background-color: gray;
  color: white;
}

.button-remove-med {
  padding: 2px 5px !important;
  color: #fff !important
}

.payment-toggle {
  display: flex;
  gap: 6px;
  height: auto !important;
}
.payment-toggle button {
  flex: 1;
  height: 34px;
  border-radius: 6px;
  border: none;
  font-weight: 600;
  background: #ccc;
  color: #222;
    height: auto !important;
}
.payment-toggle button.active {
  background: #28a745;
  color: #fff;
}

.dropdown-item-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: column;
  gap:8px;
}

.stock-indicator {
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
}

/* Colors for different stock levels */
.stock-indicator.out-of-stock {
  color: #fff;
  background-color: #e74c3c; /* red */
}

.stock-indicator.low-stock {
  color: #fff;
  background-color: #f39c12; /* orange */
}

.stock-indicator.normal-stock {
  color: #fff;
  background-color: #27ae60; /* green */
}

</style>