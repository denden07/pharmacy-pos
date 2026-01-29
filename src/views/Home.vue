<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import Swal from 'sweetalert2'

const store = useStore()

// POS refs
const search = ref('')
const selectedMedicine = ref(null)
const selectedPriceType = ref('regular')
const cart = ref([])
const professionalFee = ref(0)
const moneyGiven = ref(0)
const selectedCustomer = ref(null)
const showCustomerModal = ref(false)
const customerSearch = ref('')
const newCustomer = ref({ name:'', phone:'', address:'' })

// Focus tracking for number pad
const focusedItem = ref(null)
const focusedField = ref('') // 'qty' | 'professionalFee' | 'moneyGiven'
const setActiveInput = (item, field) => {
  focusedItem.value = item
  focusedField.value = field
}

// Number pad functions
const appendNumber = (num) => {
  if (!focusedField.value) return
  if (focusedField.value === 'qty') {
    focusedItem.value.qty = Number(String(focusedItem.value.qty) + num)
  } else if (focusedField.value === 'professionalFee') {
    professionalFee.value = Number(String(professionalFee.value) + num)
  } else if (focusedField.value === 'moneyGiven') {
    moneyGiven.value = Number(String(moneyGiven.value) + num)
  }
}
const backspace = () => {
  if (!focusedField.value) return
  if (focusedField.value === 'qty') {
    focusedItem.value.qty = Number(String(focusedItem.value.qty).slice(0,-1) || 0)
  } else if (focusedField.value === 'professionalFee') {
    professionalFee.value = Number(String(professionalFee.value).slice(0,-1) || 0)
  } else if (focusedField.value === 'moneyGiven') {
    moneyGiven.value = Number(String(moneyGiven.value).slice(0,-1) || 0)
  }
}
const clearInput = () => {
  if (!focusedField.value) return
  if (focusedField.value === 'qty') focusedItem.value.qty = 0
  else if (focusedField.value === 'professionalFee') professionalFee.value = 0
  else if (focusedField.value === 'moneyGiven') moneyGiven.value = 0
}

/* ======================
   LOAD MEDICINES & CUSTOMERS
====================== */
onMounted(async () => {
  if (!store.state.medicines.medicines.length) {
    await store.dispatch('medicines/loadMedicines')
  }
  await store.dispatch('customers/loadCustomers')
})

const medicines = computed(() => store.state.medicines.medicines || [])
const customers = computed(() => store.state.customers.customers || [])

const filteredMedicines = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return []
  return medicines.value.filter(m =>
    m.name.toLowerCase().includes(keyword) ||
    (m.generic_name || '').toLowerCase().includes(keyword)
  )
})

const filteredCustomers = computed(() => {
  const k = customerSearch.value.toLowerCase()
  return customers.value.filter(c =>
    c.name.toLowerCase().includes(k) ||
    (c.phone || '').includes(k)
  )
})

/* ======================
   CART LOGIC
====================== */
const addToCart = (med) => {
  const price = selectedPriceType.value==='regular'? med.price1: med.price2
  const existing = cart.value.find(i => i.id===med.id && i.priceType===selectedPriceType.value)
  if(existing){ 
    existing.qty += 1
  }
  else{
    cart.value.push({ 
      id: med.id,
      name: med.name,
      generic_name: med.generic_name||'',
      priceType:selectedPriceType.value,
      price,
      qty: 1
    })
  }
  selectedMedicine.value = null
  search.value = ''
}

const removeItem = (id) => { cart.value = cart.value.filter(i => i.id!==id) }
const updatePriceType = (item, type) => {
  item.priceType = type
  const med = medicines.value.find(m => m.id===item.id)
  item.price = type==='regular'? med.price1 : med.price2
}

/* ======================
   TOTALS
====================== */
const subTotal = computed(() => cart.value.reduce((sum,i)=>sum+i.price*i.qty,0))
const grandTotal = computed(() => Math.max(subTotal.value + Number(professionalFee.value || 0),0))
const change = computed(()=>Math.max((moneyGiven.value || 0) - grandTotal.value,0))

/* ======================
   CHECKOUT
====================== */
const checkout = async () => {
  if(!cart.value.length){ 
    Swal.fire({icon:'warning', title:'Empty cart', text:'Please add items before saving the sale.'})
    return
  }
  if((moneyGiven.value || 0) < grandTotal.value){
    Swal.fire({icon:'warning', title:'Insufficient payment', text:'Customer money is less than total.'})
    return
  }

  const result = await Swal.fire({
    title:'Confirm Sale',
    html:`
      <p><strong>Subtotal:</strong> ₱${subTotal.value.toFixed(2)}</p>
      <p><strong>Professional Fee:</strong> ₱${professionalFee.value || 0}</p>
      <p><strong>Money Given:</strong> ₱${moneyGiven.value || 0}</p>
      <p><strong>Change:</strong> ₱${change.value.toFixed(2)}</p>
      <hr/>
      <h3>Total: ₱${grandTotal.value.toFixed(2)}</h3>
    `,
    icon:'question',
    showCancelButton:true,
    confirmButtonText:'Save Sale',
    cancelButtonText:'Cancel',
    reverseButtons:true
  })
  if(!result.isConfirmed) return

  try{
    const saleId = await store.dispatch('sales/saveSale', {
      customer_id: selectedCustomer.value?.id || null,
      cart: cart.value,           // ✅ pass the actual array
      subTotal: subTotal.value,
      professionalFee: professionalFee.value || 0,
      finalTotal: grandTotal.value,
      moneyGiven: moneyGiven.value || 0,
      change: change.value
    })

    await Swal.fire({icon:'success', title:'Sale Saved', text:`Sale #${saleId} saved.`, timer:1500, showConfirmButton:false})

    cart.value = []
    professionalFee.value = 0
    moneyGiven.value = 0
    selectedCustomer.value = null

  } catch(err){
    console.error(err)
    Swal.fire({icon:'error', title:'Save failed', text:'Something went wrong while saving the sale.'})
  }
}

/* ======================
   CUSTOMERS
====================== */
const selectCustomer = (cust) => { selectedCustomer.value=cust; showCustomerModal.value=false }
const addCustomer = async () => {
  if(!newCustomer.value.name) return
  const id = await store.dispatch('customers/addCustomer', newCustomer.value)
  selectedCustomer.value = { id, ...newCustomer.value }
  newCustomer.value = { name:'', phone:'', address:'' }
  showCustomerModal.value=false
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
      <div class="med-name">{{ med.name }}</div>
      <div class="med-generic" v-if="med.generic_name">{{ med.generic_name }}</div>
    </div>
  </div>
</div>

<!-- Selected Customer Badge -->
<p style="    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;"><strong>Sold to:</strong> 
  <span v-if="selectedCustomer" class="selected-customer">
    <span style="font-size: 16px">👤 {{ selectedCustomer.name }}</span>
    <small style="font-size: 16px" v-if="selectedCustomer.address">({{ selectedCustomer.address }})</small>
  </span>
  <button v-if="selectedCustomer" class="mini danger" @click="selectedCustomer=null">✕</button>
</p>

<div class="pos-layout">
  <!-- CENTER: CART -->
  <div class="cart-wrapper">
    <div class="cart-table-container">
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
                <button class="mini regular" :class="{ activePrice: item.priceType==='regular' }" @click="updatePriceType(item,'regular')">Regular</button>
                <button class="mini discounted" :class="{ activePrice: item.priceType==='discounted' }" @click="updatePriceType(item,'discounted')">Discount</button>
                <span>₱{{ item.price }}</span>
              </div>
            </td>
            <td>
              <div class="qty-wrapper">
                <button @click="item.qty = Math.max(1,item.qty-1)">-</button>
                <input
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
            <td><button class="mini danger" @click="removeItem(item.id)">✕</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else>No items</p>
    </div>

    <!-- Totals below table -->
    <div class="cart-totals">
      <p><strong>Subtotal:</strong> ₱{{ subTotal.toFixed(2) }}</p>
      <p><strong>Grand Total:</strong> ₱{{ grandTotal.toFixed(2) }}</p>
      <p ><strong>Change:</strong> <span style="color: red;">₱{{ change.toFixed(2) }}</span> </p>
    </div>
  </div>

  <!-- RIGHT PANEL: Inputs + Number Pad -->
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

    <button class="btn checkout" @click="checkout">Save Sale</button>
  </div>
</div>

<!-- CUSTOMER MODAL -->
<div v-if="showCustomerModal" class="modal-backdrop">
  <div class="modal">
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
        <small v-if="c.phone || c.address">
          {{ c.phone }} <span v-if="c.address">- {{ c.address }}</span>
        </small>
      </div>
    </div>

    <hr/>
    <h4>Add New Customer</h4>
    <div class="new-customer-form">
      <label>Name<input class="input" v-model="newCustomer.name" placeholder="Customer Name" /></label>
      <label>Phone<input class="input" v-model="newCustomer.phone" placeholder="Phone Number" /></label>
      <label>Address<input class="input" v-model="newCustomer.address" placeholder="Address" /></label>
    </div>

    <div class="modal-actions">
      <button class="btn checkout" @click="addCustomer">Save</button>
      <button class="btn danger" @click="showCustomerModal=false">Cancel</button>
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
  min-height: 400px;
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
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  padding: 10px;
  border-top: 1px solid #ccc;
  background: #f9f9f9;
  font-size: 20px
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
  width: 46px;
  height: 32px;
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
  background: red
}

/* =========================
   SELECTED CUSTOMER BADGE
========================= */
.selected-customer {
  padding: 6px 10px;
  border-radius: 8px;
  background: #e6f7ff;
  border: 1px solid #3498db;
  font-size: 13px;
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
.med-name-table { font-weight:700; }
.med-generic { font-size:12px; color:#888; }

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
  height: 38px;
  border-radius: 8px;
  border: 1px solid #ccc;
  padding: 0 12px;
  font-size: 14px;
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
}

/* Modal buttons aligned */
.modal-actions {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}
.modal-actions .btn {
  flex: 1;
}

/* Customer rows cleaner */
.customer-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Dark mode fix */
.dark .modal .input,
.dark .modal input {
  background: #333;
  color: #fff;
  border-color: #555;
}

/* =========================
   MODAL INPUT & BUTTON HEIGHT FIX
========================= */

/* Search customer input */
.modal .pos-medicine-search {
  height: 38px;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
}

/* Buttons same height as inputs */
.modal-actions .btn {
  height: 38px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Ensure Save & Cancel are equal width */
.modal-actions .btn.checkout,
.modal-actions .btn.danger {
  width: 100%;
}


.modal .pos-medicine-search {
  width: 100%;
  height: 44px;          /* same as top search bar */
  font-size: 15px;
  padding: 0 14px;
  border-radius: 10px;
  box-sizing: border-box;
}

/* =========================
   PREVENT FLEX SHRINK IN MODAL
========================= */
.modal > * {
  flex-shrink: 0;
}

/* Force modal inputs to keep their size */
.modal input,
.modal .pos-medicine-search {
  flex-shrink: 0;
  min-height: 44px;
  height: 44px;
  box-sizing: border-box;
}



</style>
