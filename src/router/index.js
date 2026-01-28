import { createRouter, createWebHistory } from 'vue-router'

// Import pages (views)
import Home from '../views/Home.vue'
import Medicines from '../views/Medicines.vue'
import Inventory from '../views/Inventory.vue'
import Sales from '../views/Sales.vue'
import Customers from '../views/Customers.vue'
import Analytics from '../views/Analytics.vue'
import TransactionHistory from '../views/TransactionHistory.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/medicines', name: 'Medicines', component: Medicines },
  { path: '/inventory', name: 'Inventory', component: Inventory },
  { path: '/sales', name: 'Sales', component: Sales },
  { path: '/customers', name: 'Customers', component: Customers },
  { path: '/analytics', name: 'Analytics', component: Analytics },
  {
    path: '/customers/:id/transactions',
    name: 'TransactionHistory',
    component: TransactionHistory,
    props: route => ({ 
      customerId: route.params.id,
      tab: route.query.tab || 'points' // default tab
    }),
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
