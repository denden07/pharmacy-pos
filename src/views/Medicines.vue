<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import MedicineForm from '../components/MedicineForm.vue'
import MedicineViewModal from '../components/MedicineViewModal.vue'
import { dbPromise } from '../db'
import Swal from 'sweetalert2'

const store = useStore()

// Modals
const showForm = ref(false)
const editingMedicine = ref(null)
const showView = ref(false)
const selectedMedicine = ref(null)

// Search & filter
const searchKeyword = ref('')
const filterMode = ref('active') // active | archived | all

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)
const itemsPerPageOptions = [5, 10, 20, 50]

// Stock
const stockMap = ref({})

// Load stock
const loadStock = async () => {
  const db = await dbPromise
  const batches = await db.getAll('inventory_batches')
  const map = {}

  batches.forEach(b => {
    if (!map[b.medicine_id]) map[b.medicine_id] = 0
    map[b.medicine_id] += b.quantity || 0
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

const closeForm = async (saved = false) => {
  showForm.value = false
  editingMedicine.value = null
  await loadMedicines()

  if (saved) {
    Swal.fire({
      icon: 'success',
      title: 'Saved!',
      timer: 1200,
      showConfirmButton: false
    })
  }
}

// Data
const medicines = computed(() => store.state.medicines.medicines)

// Filter logic
const filteredMedicines = computed(() => {
  let list = medicines.value

  if (filterMode.value === 'active') {
    list = list.filter(m => !m.is_archived)
  } else if (filterMode.value === 'archived') {
    list = list.filter(m => m.is_archived)
  }

  if (!searchKeyword.value.trim()) return list

  return list.filter(m =>
    m.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
    (m.generic_name || '').toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// Pagination
const totalPages = computed(() =>
  Math.ceil(filteredMedicines.value.length / itemsPerPage.value)
)

const paginatedMedicines = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredMedicines.value.slice(start, start + itemsPerPage.value)
})

const goPage = (p) => {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
}

const pageNumbers = computed(() =>
  Array.from({ length: totalPages.value }, (_, i) => i + 1)
)

// Archive
const archiveMedicine = async (medicine) => {
  const result = await Swal.fire({
    title: 'Archive this medicine?',
    text: 'It will be hidden but not deleted.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, archive'
  })

  if (!result.isConfirmed) return

  const db = await dbPromise
  const tx = db.transaction('medicines', 'readwrite')
  const storeMed = tx.objectStore('medicines')

  await storeMed.put({ ...medicine, is_archived: true })
  await tx.done

  await loadMedicines()

  Swal.fire({
    icon: 'success',
    title: 'Archived',
    timer: 1000,
    showConfirmButton: false
  })
}

const restoreMedicine = async (medicine) => {
  const result = await Swal.fire({
    title: 'Restore this medicine?',
    text: 'It will become active again.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, restore'
  })

  if (!result.isConfirmed) return

  const db = await dbPromise
  const tx = db.transaction('medicines', 'readwrite')
  const storeMed = tx.objectStore('medicines')

  await storeMed.put({
    ...medicine,
    is_archived: false,
    updated_at: new Date()
  })

  await tx.done
  await loadMedicines()

  Swal.fire({
    icon: 'success',
    title: 'Restored',
    timer: 1000,
    showConfirmButton: false
  })
}

</script>

<template>
  <div class="medicines-page">
    <h1>Medicines</h1>

    <div class="top-bar">
      <input
        type="text"
        v-model="searchKeyword"
        placeholder="Search medicine..."
      />

      <!-- FILTER -->
      <select v-model="filterMode">
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="all">All</option>
      </select>

      <button @click="addMedicine">Add Medicine</button>

      <div class="items-per-page">
        <label>Items:</label>
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
          <th>Brand</th>
          <th>Generic</th>
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

            <button
              v-if="!med.is_archived"
              class="danger"
              @click="archiveMedicine(med)"
            >
              Archive
            </button>

            <button
              v-else
              class="restore"
              @click="restoreMedicine(med)"
            >
              Restore
            </button>
          </td>

        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1">
      <button @click="goPage(currentPage - 1)" :disabled="currentPage === 1">
        Prev
      </button>

      <button
        v-for="n in pageNumbers"
        :key="n"
        @click="goPage(n)"
        :class="{ active: currentPage === n }"
      >
        {{ n }}
      </button>

      <button @click="goPage(currentPage + 1)" :disabled="currentPage === totalPages">
        Next
      </button>
    </div>

    <!-- Modals -->
    <MedicineForm
      v-if="showForm"
      :medicineToEdit="editingMedicine"
      @close="closeForm"
      @saved="closeForm(true)"
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

.actions-td .danger {
  background-color: #e74c3c !important;
}
body.dark-mode .actions-td .danger {
  background-color: #c0392b !important;
}

.actions-td .danger {
  background-color: #e74c3c !important;
}
body.dark-mode .actions-td .danger {
  background-color: #c0392b !important;
}


.actions-td .default {
  background-color: #3498db !important;
}
body.dark-mode .actions-td .default {
  background-color: #3498db !important;
}

.actions-td .restore {
  background-color: #3498db !important;
}


</style>
