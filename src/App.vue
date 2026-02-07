<template>
  <div class="app-container">
    <Sidebar @toggle="onSidebarToggle" />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Sidebar from '../src/components/Sidebar.vue'

const sidebarWidth = ref(220)

const onSidebarToggle = (isOpen) => {
  sidebarWidth.value = isOpen ? 260 : 70
  document.documentElement.style.setProperty(
    '--sidebar-width',
    sidebarWidth.value + 'px'
  )
}
</script>

<style>
:root {
  --sidebar-width: 260px;
}
</style>

<style scoped>
.app-container {
  width: 100%;
}

/* THIS is the key fix */
.main-content {
  margin-left: var(--sidebar-width);
  width: calc(100% - var(--sidebar-width));
  min-height: 100vh;
  padding: 16px;
  transition: margin-left 0.25s ease, width 0.25s ease;
  box-sizing: border-box;
}
</style>
