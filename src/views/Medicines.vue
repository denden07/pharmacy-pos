<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import MedicineForm from '../components/MedicineForm.vue'
import MedicineViewModal from '../components/MedicineViewModal.vue'
import { dbPromise } from '../db'

const store = useStore()

// Form modal
const showForm = ref(false)
const editingMedicine = ref(null)

// View modal
const showView = ref(false)
const selectedMedicine = ref(null)

// Search
const searchKeyword = ref('')

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)
const itemsPerPageOptions = [5, 10, 20, 50]

// Stock map
const stockMap = ref({})

// Load medicines & stock
const loadStock = async () => {
  const db = await dbPromise
  const batches = await db.getAll('inventory_batches')
  const map = {}
  batches.forEach(batch => {
    const medId = batch.medicine_id
    const qty = batch.quantity || 0
    if (!map[medId]) map[medId] = 0
    map[medId] += qty
  })
  stockMap.value = map
}

const loadMedicines = async () => {
  await store.dispatch('medicines/loadMedicines')
  await loadStock()
}

onMounted(loadMedicines)

// Modal handlers
const addMedicine = () => {
  editingMedicine.value = null
  showForm.value = true
}

const editMedicine = (medicine) => {
  editingMedicine.value = medicine
  showForm.value = true
}

const viewMedicine = (medicine) => {
  selectedMedicine.value = medicine
  showView.value = true
}

const closeForm = async () => {
  showForm.value = false
  editingMedicine.value = null
  await loadMedicines()
}

// --- Computed for search & pagination ---
const medicines = computed(() => store.state.medicines.medicines)

const filteredMedicines = computed(() => {
  if (!searchKeyword.value.trim()) return medicines.value
  return medicines.value.filter(
    m =>
      m.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      (m.generic_name || '').toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

const totalPages = computed(() => Math.ceil(filteredMedicines.value.length / itemsPerPage.value))

const paginatedMedicines = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredMedicines.value.slice(start, start + itemsPerPage.value)
})

const goPage = (page) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

const pageNumbers = computed(() => Array.from({ length: totalPages.value }, (_, i) => i + 1))
</script>

<template>
  <div class="medicines-page">
    <h1>Medicines</h1>

    <div class="top-bar">
      <input type="text" v-model="searchKeyword" placeholder="Search medicine..." />

      <button @click="addMedicine">Add Medicine</button>

      <div class="items-per-page">
        <label>Items per page:</label>
        <select v-model.number="itemsPerPage">
          <option v-for="opt in itemsPerPageOptions" :key="opt" :value="opt">
            {{ opt }}
          </option>
        </select>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Brand Name</th>
          <th>Generic Name</th>
          <th>Price 1</th>
          <th>Price 2</th>
          <th>Stock</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="med in paginatedMedicines" :key="med.id">
          <td>{{ med.name }}</td>
          <td>{{ med.generic_name || '—' }}</td>
          <td>₱{{ med.price1 }}</td>
          <td>₱{{ med.price2 }}</td>
          <td>{{ stockMap[med.id] || 0 }}</td>
          <td class="actions-td">
            <button @click="editMedicine(med)">Edit</button>
            <button @click="viewMedicine(med)">View</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1">
      <button @click="goPage(currentPage - 1)" :disabled="currentPage === 1">Prev</button>

      <button
        v-for="num in pageNumbers"
        :key="num"
        @click="goPage(num)"
        :class="{ active: currentPage === num }"
      >
        {{ num }}
      </button>

      <button @click="goPage(currentPage + 1)" :disabled="currentPage === totalPages">Next</button>
    </div>

    <!-- Modals -->
    <MedicineForm
      v-if="showForm"
      :medicineToEdit="editingMedicine"
      @close="closeForm"
    />

    <MedicineViewModal
      v-if="showView"
      :medicine="selectedMedicine"
      :show="showView"
      @close="showView = false"
    />
  </div>
</template>

<style scoped>
.medicines-page {
  margin: auto;
  padding: 20px;
  transition: background-color 0.3s, color 0.3s;
  overflow-x: hidden !important;
}

/* Dark mode support */
body.dark-mode .medicines-page {
  background-color: #121212 !important;
  color: #eee !important;
}

/* ===========================
   TOP BAR
=========================== */
.top-bar {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 10px !important;
  align-items: center !important;
  margin-bottom: 12px !important;
}

/* INPUT */
.top-bar input {
  appearance: none !important;
  -webkit-appearance: none !important;
  flex: 1 !important;
  min-width: 150px !important;
  min-height: 40px !important;
  padding: 8px 12px !important;
  border-radius: 8px !important;
  border: 1px solid #ccc !important;
  background-color: #fff !important;
  color: #222 !important;
  font-size: 16px !important;
}

body.dark-mode .top-bar input {
  background-color: #1c1c1c !important;
  border-color: #333 !important;
  color: #eee !important;
}

.top-bar input:focus {
  border-color: #1abc9c !important;
}

/* SELECT */
.top-bar select {
  appearance: none !important;
  -webkit-appearance: none !important;
  min-height: 40px !important;
  padding: 8px 12px !important;
  border-radius: 8px !important;
  border: 1px solid #ccc !important;
  background-color: #fff !important;
  color: #222 !important;
  font-size: 16px !important;
}

body.dark-mode .top-bar select {
  background-color: #1c1c1c !important;
  border-color: #333 !important;
  color: #eee !important;
}

.items-per-page {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}

/* ===========================
   BUTTONS
=========================== */
button {
  appearance: none !important;
  -webkit-appearance: none !important;
  min-height: 40px !important;
  padding: 8px 14px !important;
  border-radius: 8px !important;
  border: none !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  background-color: #1abc9c !important;
  color: #fff !important;
}

button:active {
  transform: scale(0.97);
}

body.dark-mode button {
  background-color: #16a085 !important;
}

/* ===========================
   TABLE (ANDROID SAFE)
=========================== */
table {
  width: 100% !important;
  margin-top: 10px !important;
  border-collapse: collapse !important;
  overflow-x: auto !important;
  white-space: nowrap !important;
  -webkit-overflow-scrolling: touch !important;
}

th, td {
  border: 1px solid #ccc !important;
  padding: 8px !important;
  text-align: left !important;
}

body.dark-mode table,
body.dark-mode th,
body.dark-mode td {
  border-color: #333 !important;
}

/* ===========================
   ACTION BUTTONS
=========================== */
.actions-td button {
  margin-right: 6px !important;
  padding: 6px 10px !important;
}

body.dark-mode .actions-td button {
  background-color: #222 !important;
  color: #eee !important;
}

body.dark-mode .actions-td button:hover {
  background-color: #333 !important;
}

/* ===========================
   PAGINATION
=========================== */
.pagination {
  margin-top: 12px !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  gap: 6px !important;
  flex-wrap: wrap !important;
}

.pagination button.active {
  background-color: #1abc9c !important;
  color: #fff !important;
  border-radius: 6px !important;
  padding: 6px 12px !important;
}

body.dark-mode .pagination button.active {
  background-color: #16a085 !important;
}

/* ===========================
   MOBILE FIXES
=========================== */
@media (max-width: 768px) {
  .top-bar {
    flex-direction: column !important;
    align-items: stretch !important;
  }

  .top-bar button {
    width: 100% !important;
  }

  .pagination {
    gap: 4px !important;
  }
}

</style>
