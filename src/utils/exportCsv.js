function escapeCSV(value) {
  if (value === null || value === undefined) return ''
  const str = String(value).replace(/"/g, '""')
  return `"${str}"`
}

export function downloadCSV(filename, rows) {
  if (!rows.length) return

  const headers = Object.keys(rows[0])

  // ===== Calculate totals =====
  const totalTransactions = rows.length
  const totalSales = rows.reduce((sum, r) => sum + Number(r.total || 0), 0)

  // ===== Add empty row + totals =====
  const rowsWithTotals = [
    ...rows,
    {}, // empty row
    { [headers[0]]: 'TOTAL TRANSACTIONS', [headers[1]]: totalTransactions },
    { [headers[0]]: 'TOTAL SALES', [headers[1]]: totalSales.toFixed(2) }
  ]

  const csv = [
    headers.join(','),
    ...rowsWithTotals.map(row =>
      headers.map(h => escapeCSV(row[h])).join(',')
    )
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}
