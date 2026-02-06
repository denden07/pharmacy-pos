<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

// Sidebar open state
const isOpen = ref(true)

// Night mode
const isDarkMode = ref(localStorage.getItem('darkMode') === 'true')

// Apply dark mode on load
if (isDarkMode.value) {
  document.body.classList.add('dark-mode')
}

const emit = defineEmits(['toggle'])


// Toggle sidebar
const toggleSidebar = () => {
  isOpen.value = !isOpen.value
  document.documentElement.style.setProperty(
    '--sidebar-width',
    isOpen.value ? '220px' : '60px'
  )

  emit('toggle', isOpen.value)
}

// Toggle dark mode
const toggleNightMode = () => {
  isDarkMode.value = !isDarkMode.value

  document.body.classList.toggle('dark-mode', isDarkMode.value)
  localStorage.setItem('darkMode', isDarkMode.value)
}

// Menu
const menuItems = [
  { name: 'Home', path: '/', icon: '🏠' },
  { name: 'Medicines', path: '/medicines', icon: '💊' },
  { name: 'Sales', path: '/sales', icon: '💰' },
  { name: 'Customers', path: '/customers', icon: '🧑‍🤝‍🧑' },
  { name: 'Analytics', path: '/analytics', icon: '📊' },
  { name: 'Settings', path: '/settings', icon: '⚙️' }, // ⚙️ Settings
]

const isActive = (path) => route.path === path
</script>

<template>
  <nav :class="['sidebar', { collapsed: !isOpen }]">
    <!-- Hamburger -->
    <button class="hamburger" @click="toggleSidebar">
      ☰
    </button>

    <!-- Night Mode -->
    <div class="night-mode">
      <label v-if="isOpen">
        <input type="checkbox" :checked="isDarkMode" @change="toggleNightMode" />
        Night Mode
      </label>
      <span v-else title="Night Mode">🌙</span>
    </div>

    <h2 v-if="isOpen" class="sidebar-title">Pharmacy POS</h2>

    <ul>
      <li v-for="item in menuItems" :key="item.path">
        <button
          :class="{ active: isActive(item.path) }"
          @click="router.push(item.path)"
        >
          <span class="icon">{{ item.icon }}</span>
          <span v-if="isOpen">{{ item.name }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* SIDEBAR */
.sidebar {
  position: fixed;  
  width: 220px;
  min-width: 220px;
  height: 100vh;
  background: #2d3e50;
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 16px;
  transition: width 0.25s ease;
}

/* COLLAPSED */
.sidebar.collapsed {
  width: 60px;
  min-width: 60px;
}


/* HAMBURGER */
.hamburger {
  background: #1abc9c;
  border: none;
  color: white;
  font-size: 18px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 12px;
}


.sidebar.collapsed button {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* NIGHT MODE */
.night-mode {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

/* TITLE */
.sidebar-title {
  text-align: center;
  margin-bottom: 16px;
}

/* MENU */
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
}

button {
  width: 100%;
  background: none;
  border: none;
  color: inherit;
  padding: 10px;
  display: flex;
  gap: 12px;
  align-items: center;
  cursor: pointer;
  border-radius: 6px;
}

button:hover {
  background: #3b4c60;
}

button.active {
  background: #1abc9c;
  color: #fff;
}

/* ICON */
.icon {
  width: 24px;
  text-align: center;
}

/* DARK MODE */
body.dark-mode {
  background: #121212;
  color: #eee;
}

body.dark-mode .sidebar {
  background: #1e1e1e;
}

body.dark-mode button:hover {
  background: #333;
}
</style>
