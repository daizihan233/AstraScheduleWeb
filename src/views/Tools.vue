<script setup>
import { NButton, NCard, NFlex, NInput, NSpace, NText, NRadioGroup, NRadioButton, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { fullExport, fullImport } from '@/api/backup.js'
import ConfirmPasswordModal from '@/components/ConfirmPasswordModal.vue'

const messages = useMessage()
const backupPwd = ref('')
const importFile = ref(null)
const backupImporting = ref(false)
const backupExporting = ref(false)
const importFileInputRef = ref(null)
const importMode = ref('overwrite')

// 密码确认弹窗
const showPwdModal = ref(false)
const pwdModalLoading = ref(false)
const pwdModalAction = ref('')

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

// 打开密码确认弹窗
function openExportModal() {
  if (!backupPwd.value) {
    messages.warning('请先输入备份/还原密码')
    return
  }
  pwdModalAction.value = 'export'
  showPwdModal.value = true
}

function openImportModal() {
  if (!backupPwd.value) {
    messages.warning('请先输入备份/还原密码')
    return
  }
  if (!importFile.value) {
    messages.warning('请先选择备份文件')
    return
  }
  pwdModalAction.value = 'import'
  showPwdModal.value = true
}

// 密码确认后执行
async function onPwdConfirm(password) {
  pwdModalLoading.value = true
  try {
    if (pwdModalAction.value === 'export') {
      const resp = await fullExport(password)
      const now = new Date()
      const pad = (n) => String(n).padStart(2, '0')
      const name = `astra-full-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`
      saveBlob(resp.data, name)
      messages.success('完整备份导出成功')
    } else if (pwdModalAction.value === 'import') {
      const resp = await fullImport(importFile.value, password, importMode.value)
      const msg = resp?.data?.message || '备份导入成功'
      const modeText = importMode.value === 'overwrite' ? '（覆盖重复数据）' : '（跳过重复数据）'
      messages.success(`${msg}${modeText}，建议刷新页面检查配置`)
      importFile.value = null
      if (importFileInputRef.value) {
        importFileInputRef.value.value = ''
      }
    }
    showPwdModal.value = false
  } catch (error) {
    const status = error?.response?.status
    const detail = error?.response?.data?.detail || error?.response?.data?.error || ''
    if (status === 401) messages.error('你寻思寻思这密码它对吗？')
    else if (status === 400) messages.error(detail || '导入失败：文件格式或内容无效')
    else messages.error(`导入失败（状态码：${status || 'unknown'}）`)
  } finally {
    pwdModalLoading.value = false
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
          <NButton type="primary" @click="openExportModal">导出备份</NButton>
          <NButton @click="pickImportFile">选择备份文件</NButton>
          <NText depth="3">{{ importFile ? importFile.name : '未选择文件' }}</NText>
        </NFlex>
        <input
          ref="importFileInputRef"
          type="file"
          accept=".json,application/json"
          style="display: none"
          @change="onImportFileChange"
        />
        <NText depth="3">导入模式：</NText>
        <NRadioGroup v-model:value="importMode">
          <NRadioButton value="overwrite">覆盖（更新重复数据）</NRadioButton>
          <NRadioButton value="skip">跳过（保留重复数据）</NRadioButton>
        </NRadioGroup>
        <NButton type="warning" :disabled="!importFile" @click="openImportModal">导入还原</NButton>
      </NSpace>
    </NCard>

    <ConfirmPasswordModal
      v-model:show="showPwdModal"
      :loading="pwdModalLoading"
      confirm-text="确认操作"
      @confirm="onPwdConfirm"
    />
  </NFlex>
</template>