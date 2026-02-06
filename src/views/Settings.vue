<script setup>
import { ref } from 'vue'
import { dbPromise } from '../db'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { Device } from '@capacitor/device'
import { FilePicker } from '@capawesome/capacitor-file-picker'

const status = ref('')
const progress = ref(0)
const fileName = ref('pharmacy_pos_backup.json')
const restoreInput = ref(null)

async function backupDB() {
  status.value = 'Preparing backup...'
  progress.value = 0
  try {
    const db = await dbPromise
    const backupData = {}
    const storeNames = Array.from(db.objectStoreNames)

    for (let i = 0; i < storeNames.length; i++) {
      const name = storeNames[i]
      backupData[name] = await db.getAll(name)
      progress.value = Math.round(((i + 1) / storeNames.length) * 100)
    }

    const jsonString = JSON.stringify(backupData)
    const info = await Device.getInfo()

    if (info.platform === 'web' || !info.platform) {
      // Web download
      const blob = new Blob([jsonString], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = fileName.value
      link.click()
      URL.revokeObjectURL(link.href)
      status.value = 'Backup downloaded!'
    } else {
      // Mobile save/share
      const writeResult = await Filesystem.writeFile({
        path: fileName.value,
        data: jsonString,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      })

      await Share.share({
        title: 'Pharmacy POS Backup',
        text: 'Your backup is ready!',
        url: writeResult.uri,
      })
      status.value = 'Backup saved/shared!'
    }
  } catch (err) {
    console.error(err)
    status.value = 'Backup failed: ' + err.message
  }
}

async function restoreDB() {
  status.value = 'Initializing restore...'
  progress.value = 0
  try {
    const info = await Device.getInfo()
    let jsonString = ''

    if (info.platform === 'web' || !info.platform) {
      // Web restore from input
      if (!restoreInput.value) throw new Error('No file input found')
      const files = restoreInput.value.files
      if (!files || !files.length) throw new Error('No file selected')
      jsonString = await files[0].text()
    } else {
      // Mobile restore
      const picked = await FilePicker.pickFiles({ 
        multiple: false, 
        readData: true 
      })
      if (!picked.files.length) throw new Error('No file picked')
      const file = picked.files[0]
      if (!file.data) throw new Error('File content is empty or unreadable')
      jsonString = atob(file.data)
    }

    const backupData = JSON.parse(jsonString)
    const db = await dbPromise
    const storeNames = Array.from(db.objectStoreNames)
    
    const tx = db.transaction(storeNames, 'readwrite')

    for (let i = 0; i < storeNames.length; i++) {
      const storeName = storeNames[i]
      const store = tx.objectStore(storeName)
      
      await store.clear()
      
      const items = backupData[storeName] || []
      for (const item of items) {
        store.put(item)
      }
      
      progress.value = Math.round(((i + 1) / storeNames.length) * 100)
      status.value = `Restoring: ${storeName}...`
    }

    await tx.done
    status.value = 'Restore completed successfully!'
  } catch (err) {
    console.error(err)
    status.value = 'Restore failed: ' + err.message
  } finally {
    setTimeout(() => { progress.value = 0 }, 3000)
  }
}
</script>

<template>
  <div class="backup-page">
    <h1>Database Management</h1>

    <p class="note">
      💡 <b>Tip:</b> Keep your backups in a safe place (Google Drive, Email) to prevent data loss.
    </p>

    <div class="actions">
      <button class="btn-backup" @click="backupDB">Backup Database</button>

      <div class="restore-section">
        <label class="file-label">
          Select Backup File:
          <input type="file" accept=".json" ref="restoreInput" />
        </label>
        
        <button class="btn-restore" @click="restoreDB">
          Restore Database
        </button>
      </div>
    </div>

    <div v-if="progress > 0" class="progress-container">
      <div class="progress-bar" :style="{ width: progress + '%' }"></div>
      <span class="progress-text">{{ progress }}%</span>
    </div>

    <p class="status" :class="{ 'error': status.includes('failed') }">
      {{ status }}
    </p>
  </div>
</template>

<style scoped>
.backup-page {
  padding: 20px;
  font-family: sans-serif;
}

.note {
  background-color: #e3f2fd;
  border-left: 4px solid #2196f3;
  padding: 12px;
  margin-bottom: 25px;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.restore-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

button {
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  color: white;
  transition: opacity 0.2s;
}

.btn-backup { background-color: #2ecc71; }
.btn-restore { background-color: #3498db; }

button:active { opacity: 0.7; }

.progress-container {
  margin-top: 25px;
  background-color: #eee;
  border-radius: 10px;
  height: 20px;
  position: relative;
  overflow: hidden;
}

.progress-bar {
  background-color: #2ecc71;
  height: 100%;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  font-weight: bold;
  color: #333;
}

.status {
  margin-top: 15px;
  font-style: italic;
  color: #666;
}

.error { color: #e74c3c; font-weight: bold; }

.file-label {
  font-size: 0.8rem;
  color: #666;
}
</style>
