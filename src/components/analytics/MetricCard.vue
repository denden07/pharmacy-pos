<template>
  <div class="metric-card">
    <div class="metric-title">{{ title }}</div>

    <div class="metric-value">
      <span v-if="type === 'currency'">₱</span>{{ formattedValue }}
    </div>

    <div class="metric-period" v-if="periodLabel">
      {{ periodLabel }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: String,
  value: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
    default: 'currency' // 'currency' | 'number'
  },
  period: {
    type: String,
    default: '' // daily, weekly, monthly, yearly
  }
})

const formattedValue = computed(() => {
  return Number(props.value || 0).toLocaleString()
})

const periodLabel = computed(() => {
  switch (props.period) {
    case 'daily': return 'Today'
    case 'weekly': return 'This Week'
    case 'monthly': return 'This Month'
    case 'yearly': return 'This Year'
    default: return ''
  }
})
</script>

<style scoped>
.metric-card {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  padding: 16px;
  flex: 1 1 150px;
  text-align: center;
}

.metric-title {
  font-size: 14px;
  font-weight: 500;
  color: #555;
  margin-bottom: 6px;
}

.metric-value {
  font-size: 26px;
  font-weight: bold;
  margin-bottom: 4px;
}

.metric-period {
  font-size: 12px;
  color: #888;
}

body.dark-mode .metric-card {
  background-color: #1c1c1c;
  color: #eee;
}
</style>
