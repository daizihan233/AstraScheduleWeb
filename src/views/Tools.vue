<script setup>
import { NButton, NCard, NFlex, NInput, NSpace, NText, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { exportBackup, importBackup } from '@/api/backup.js'

const messages = useMessage()
const backupPwd = ref('')
const importFile = ref(null)
const backupImporting = ref(false)
const backupExporting = ref(false)
const importFileInputRef = ref(null)

function saveBlob(content, filename) {
  const url = globalThis.URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  globalThis.URL.revokeObjectURL(url)
}

function pickImportFile() {
  importFileInputRef.value?.click()
}

function onImportFileChange(e) {
  const files = e?.target?.files
  importFile.value = files && files.length > 0 ? files[0] : null
}

async function handleExportBackup() {
  if (!backupPwd.value) {
    messages.warning('请先输入备份/还原密码')
    return
  }
  backupExporting.value = true
  try {
    const resp = await exportBackup(backupPwd.value)
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const name = `astra-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`
    saveBlob(resp.data, name)
    messages.success('备份导出成功')
  } catch (error) {
    const status = error?.response?.status
    if (status === 401) messages.error('你寻思寻思这密码它对吗？')
    else messages.error(`导出失败（状态码：${status || 'unknown'}）`)
  } finally {
    backupExporting.value = false
  }
}

async function handleImportBackup() {
  if (!backupPwd.value) {
    messages.warning('请先输入备份/还原密码')
    return
  }
  if (!importFile.value) {
    messages.warning('请先选择备份文件')
    return
  }
  backupImporting.value = true
  try {
    const resp = await importBackup(importFile.value, backupPwd.value)
    const msg = resp?.data?.message || '备份导入成功'
    messages.success(`${msg}，建议刷新页面检查配置`)
    importFile.value = null
    if (importFileInputRef.value) {
      importFileInputRef.value.value = ''
    }
  } catch (error) {
    const status = error?.response?.status
    const detail = error?.response?.data?.detail || error?.response?.data?.error || ''
    if (status === 401) messages.error('你寻思寻思这密码它对吗？')
    else if (status === 400) messages.error(detail || '导入失败：文件格式或内容无效')
    else messages.error(`导入失败（状态码：${status || 'unknown'}）`)
  } finally {
    backupImporting.value = false
  }
}
</script>

<template>
  <NFlex vertical>
    <NCard title="实用工具">
      <NText depth="3">系统迁移工具：支持完整导出/导入数据库配置（JSON），用于跨数据库迁移（如 MySQL → SQLite）。</NText>
    </NCard>

    <NCard title="系统备份 / 还原">
      <NSpace vertical>
        <NText depth="3">管理密码（BasicAuth token）</NText>
        <NInput v-model:value="backupPwd" type="password" placeholder="请输入密码" clearable />
        <NFlex>
          <NButton type="primary" :loading="backupExporting" @click="handleExportBackup">导出备份</NButton>
          <NButton :loading="backupImporting" @click="pickImportFile">选择备份文件</NButton>
          <NText depth="3">{{ importFile ? importFile.name : '未选择文件' }}</NText>
        </NFlex>
        <input
          ref="importFileInputRef"
          type="file"
          accept=".json,application/json"
          style="display: none"
          @change="onImportFileChange"
        />
        <NButton type="warning" :disabled="!importFile" :loading="backupImporting" @click="handleImportBackup">导入还原</NButton>
      </NSpace>
    </NCard>
  </NFlex>
</template>