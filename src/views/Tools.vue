<script setup>
import { NButton, NCard, NFlex, NForm, NFormItem, NInput, NModal, NSelect, NSpace, NText, NRadioGroup, NRadioButton, useMessage } from 'naive-ui'
import { computed, reactive, ref, watch } from 'vue'
import axios from 'axios'
import { useRequest } from 'vue-request'
import { useRouter } from 'vue-router'
import { fullExport, fullImport } from '@/api/backup.js'
import ConfirmPasswordModal from '@/components/ConfirmPasswordModal.vue'
import { APISRV } from '../global.js'

const messages = useMessage()

// -------------------- 配置复制（复制自...） --------------------
const structureData = ref([])
const copyPwd = ref('')
const showCopyModal = ref(false)
const copyLoading = ref(false)
const copyForm = reactive({
  fromSchool: '',
  fromGrade: '',
  fromClass: '',
  toSchool: '',
  toGrade: '',
  toClass: ''
})

const getStructure = () => axios.get(`${APISRV}/web/structure`)
useRequest(getStructure, {
  initialData: [],
  onSuccess: (response) => {
    structureData.value = Array.isArray(response.data) ? response.data : []
  }
})

function getSchoolNode(school) {
  return structureData.value.find(x => x.text === school)
}

function getGradeNode(school, grade) {
  const schoolNode = getSchoolNode(school)
  const grades = Array.isArray(schoolNode?.children) ? schoolNode.children : []
  return grades.find(x => x.text === grade)
}

function toOptions(arr = []) {
  return arr.map(x => ({ label: x.text, value: x.text }))
}

const schoolOptions = computed(() => toOptions(structureData.value))
const fromGradeOptions = computed(() => {
  const schoolNode = getSchoolNode(copyForm.fromSchool)
  return toOptions(Array.isArray(schoolNode?.children) ? schoolNode.children : [])
})
const fromClassOptions = computed(() => {
  const gradeNode = getGradeNode(copyForm.fromSchool, copyForm.fromGrade)
  return toOptions(Array.isArray(gradeNode?.children) ? gradeNode.children : [])
})

watch(() => copyForm.fromSchool, () => {
  copyForm.fromGrade = ''
  copyForm.fromClass = ''
})
watch(() => copyForm.fromGrade, () => {
  copyForm.fromClass = ''
})

function validateCopyForm() {
  if (!copyForm.fromSchool || !copyForm.fromGrade || !copyForm.fromClass) {
    messages.warning('请完整选择来源 学校/年级/班级')
    return false
  }
  if (!copyForm.toSchool || !copyForm.toGrade || !copyForm.toClass) {
    messages.warning('请完整选择目标 学校/年级/班级')
    return false
  }
  if (
    copyForm.fromSchool === copyForm.toSchool &&
    copyForm.fromGrade === copyForm.toGrade &&
    copyForm.fromClass === copyForm.toClass
  ) {
    messages.warning('来源与目标不能完全相同')
    return false
  }
  return true
}

function openCopyModal() {
  if (!validateCopyForm()) return
  showCopyModal.value = true
}

async function doCopyConfig() {
  if (!validateCopyForm()) return
  copyLoading.value = true
  try {
    await axios.post(
      `${APISRV}/web/config/copy`,
      {
        from: {
          school: copyForm.fromSchool,
          grade: copyForm.fromGrade,
          class: copyForm.fromClass
        },
        to: {
          school: copyForm.toSchool,
          grade: copyForm.toGrade,
          class: copyForm.toClass
        }
      },
      {
        auth: {
          username: 'ElectronClassSchedule',
          password: copyPwd.value
        }
      }
    )
    messages.success('复制完成')
    showCopyModal.value = false
    copyPwd.value = ''
  } catch (error) {
    const status = error?.response?.status
    const detail = error?.response?.data?.detail || error?.response?.data?.error || ''
    if (status === 401) {
      messages.error('你寻思寻思这密码它对吗？')
    } else if (status === 400 || status === 404) {
      messages.error(detail || `复制失败（${status}）`)
    } else {
      messages.error(`复制失败（${status || 'unknown'}）`)
    }
  } finally {
    copyLoading.value = false
  }
}

const router = useRouter()
const importFile = ref(null)
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
  pwdModalAction.value = 'export'
  showPwdModal.value = true
}

function openImportModal() {
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

    <NCard title="配置复制">
      <NFlex vertical>
        <NText depth="3">将来源班级的科目配置、作息配置、课表配置、通用设置，复制到目标班级（目标存在时会覆盖）。</NText>
        <NFlex>
          <NCard size="small" title="来源">
            <NForm :show-label="true" label-placement="top">
              <NFormItem label="学校">
                <NSelect v-model:value="copyForm.fromSchool" :options="schoolOptions" placeholder="选择来源学校"/>
              </NFormItem>
              <NFormItem label="年级">
                <NSelect v-model:value="copyForm.fromGrade" :options="fromGradeOptions" placeholder="选择来源年级"/>
              </NFormItem>
              <NFormItem label="班级">
                <NSelect v-model:value="copyForm.fromClass" :options="fromClassOptions" placeholder="选择来源班级"/>
              </NFormItem>
            </NForm>
          </NCard>
          <NCard size="small" title="目标">
            <NForm :show-label="true" label-placement="top">
              <NFormItem label="学校">
                <NInput v-model:value="copyForm.toSchool" placeholder="输入目标学校"/>
              </NFormItem>
              <NFormItem label="年级">
                <NInput v-model:value="copyForm.toGrade" placeholder="输入目标年级"/>
              </NFormItem>
              <NFormItem label="班级">
                <NInput v-model:value="copyForm.toClass" placeholder="输入目标班级"/>
              </NFormItem>
            </NForm>
          </NCard>
        </NFlex>
        <NFlex justify="center">
          <NButton type="primary" @click="openCopyModal">复制配置</NButton>
        </NFlex>
      </NFlex>
    </NCard>

    <NCard title="系统备份 / 还原">
      <NSpace vertical>
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

    <NCard title="调休导入">
      <NSpace vertical>
        <NText depth="3">批量导入全年调休数据，支持选择生效域并逐条写入。</NText>
        <NButton type="primary" @click="router.push('/tools/compensation-import')">打开调休导入</NButton>
      </NSpace>
    </NCard>

    <ConfirmPasswordModal
      v-model:show="showPwdModal"
      :loading="pwdModalLoading"
      confirm-text="确认操作"
      @confirm="onPwdConfirm"
    />

    <NModal v-model:show="showCopyModal" preset="dialog" title="确认复制">
      <template #header>
        <div>确认复制配置？</div>
      </template>
      <NFlex vertical>
        <div>来源：{{ copyForm.fromSchool }}/{{ copyForm.fromGrade }}/{{ copyForm.fromClass }}</div>
        <div>目标：{{ copyForm.toSchool }}/{{ copyForm.toGrade }}/{{ copyForm.toClass }}</div>
        <div>此操作需要密码</div>
        <NInput v-model:value="copyPwd" clearable placeholder="请输入密码" type="password"/>
      </NFlex>
      <template #action>
        <NButton :loading="copyLoading" type="primary" @click="doCopyConfig">确认复制</NButton>
      </template>
    </NModal>
  </NFlex>
</template>