<template>
  <div class="app-container">
    <Sidebar />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import Sidebar from '../src/components/Sidebar.vue'
</script>

<style>
:root {
  --sidebar-width: 0;
}
</style>

<style scoped>
.app-container {
  width: 100%;
}

/* Main content takes full width */
.main-content {
  width: 100%;
  min-height: 100vh;
  padding: 0 16px;
  box-sizing: border-box;
}
</style>
