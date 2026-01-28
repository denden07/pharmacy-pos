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


<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  width: 100%;
}


/* If sidebar is closed on small screens, main content takes full width */
@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
  }
}

.main-content {
  /* margin-left: 220px; */
  padding: 16px;
  min-height: 100vh;
  overflow-y: auto;
  width:100%
}

/* Sidebar collapsed */
body.sidebar-collapsed .main-content {
  margin-left: 60px;
}

/* Mobile */
@media (max-width: 768px) {
  .main-content {
    margin-left: 0 !important;
    padding: 12px;
  }
}
</style>