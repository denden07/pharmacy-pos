import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Device } from '@capacitor/device';


function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export async function downloadCSV(filename, rows) {
  if (!rows || !rows.length) {
    console.error('No data to export');
    return;
  }

  const headers = Object.keys(rows[0]);

  // ===== Calculate totals =====
  const totalTransactions = rows.length;
  const totalSales = rows.reduce((sum, r) => sum + Number(r.final_total || 0), 0);

  // ===== Build the Row Data =====
  const rowsWithTotals = [
    ...rows,
    {}, // empty row for spacing
    { [headers[0]]: 'TOTAL TRANSACTIONS', [headers[1]]: totalTransactions },
    { [headers[0]]: 'TOTAL SALES', [headers[1]]: totalSales.toFixed(2) }
  ];

  // ===== Generate CSV String =====
  const csvString = [
    headers.join(','),
    ...rowsWithTotals.map(row =>
      headers.map(h => escapeCSV(row[h])).join(',')
    )
  ].join('\n');

  try {
    // Check if we are running on a native platform (Android/iOS)
    const info = await Device.getInfo();
    
    if (info.platform === 'web') {
      // --- WEB FALLBACK ---
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } else {
      // --- NATIVE CAPACITOR LOGIC ---
      
      // 1. Write the file to the app's cache or documents
      const writeFileResult = await Filesystem.writeFile({
        path: filename,
        data: csvString,
        directory: Directory.Cache, // Cache is usually more reliable for sharing
        encoding: Encoding.UTF8,
      });

      // 2. Open the Native Share Sheet
      // This allows the user to save to Drive, send via Email, or Open in Excel
      await Share.share({
        title: 'Export CSV',
        text: 'Your CSV report is ready.',
        url: writeFileResult.uri,
        dialogTitle: 'Save or Share Report',
      });
    }
  } catch (error) {
    console.error('CSV Export Error:', error);
    alert('Failed to export CSV: ' + error.message);
  }
}