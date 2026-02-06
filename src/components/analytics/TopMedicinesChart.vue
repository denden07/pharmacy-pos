<script setup>
import { defineProps, watch, ref } from 'vue'
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale)

const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: () => ({ labels: [], datasets: [] }) // Safe default
  },
  period: { type: String, default: '' }
})

const chartData = ref({ labels: [], datasets: [] })
const chartOptions = ref({
  responsive: true,
  plugins: {
    legend: { position: 'top' },
    title: { display: true, text: 'Sales Trend' }
  }
})

// Update chart whenever props.data changes
watch(
  () => props.data,
  (newData) => {
    chartData.value = newData || { labels: [], datasets: [] }
  },
  { immediate: true }
)
</script>

<template>
  <Line :chart-data="chartData" :chart-options="chartOptions" />
</template>
