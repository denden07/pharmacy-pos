<template>
  <div class="points-summary">
    <table>
      <thead>
        <tr>
          <th>Customer</th>
          <th>Points Earned</th>
          <th>Points Redeemed</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in data" :key="c.customerId">
          <td>{{ c.name }}</td>
          <td>{{ c.pointsEarned }}</td>
          <td>{{ c.pointsRedeemed }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  period: {
    type: String,
    default: 'monthly'
  }
})
</script>

<style scoped>
.points-summary table {
  width: 100%;
  border-collapse: collapse;
}

.points-summary th, .points-summary td {
  border: 1px solid #ccc;
  padding: 8px;
  text-align: left;
}

body.dark-mode .points-summary th,
body.dark-mode .points-summary td {
  border-color: #333;
  color: #eee;
}
</style>
