<script setup>
import { ref } from 'vue'
import { useRequest } from 'vue-request'
import { useMessage, NButton, NCard, NForm, NFormItem, NInputNumber, NSelect, NSpace } from 'naive-ui'
import { AutorunType, fetchCompYearPairs, fetchScopeTree, flattenScope, saveAutorun } from '@/api/autorun.js'
import { applyDisabledToScopeOptions, normalizeScopes } from '@/utils/scope.js'
import ConfirmPasswordModal from '@/components/ConfirmPasswordModal.vue'

const message = useMessage()

// 作用域
const scopeSelectOptions = ref([])
useRequest(fetchScopeTree, {
  manual: false,
  onSuccess: (res) => { scopeSelectOptions.value = flattenScope(res?.data || []) },
  onError: (e) => { console.warn('[scope] 获取失败', e); scopeSelectOptions.value = [] }
})

const scope = ref([])
const importYear = ref(new Date().getFullYear())
const importAllScope = ref(true)
const importing = ref(false)
const showPwd = ref(false)

function onScopeChange(v) {
  scope.value = normalizeScopes(v)
}

function buildImportScope() {
  if (importAllScope.value) return ['ALL']
  return Array.isArray(scope.value) ? scope.value : []
}

async function processImportPairs(pairs, scopePayload, password) {
  let ok = 0, fail = 0, aborted = false
  for (const p of pairs) {
    if (aborted) break
    const { holiday, workday } = p || {}
    if (!holiday || !workday) {
      fail++
      continue
    }
    const payload = {
      type: AutorunType.COMPENSATION,
      scope: scopePayload,
      priority: 0,
      content: { date: workday, useDate: holiday }
    }
    try {
      await saveAutorun(payload, password)
      ok++
    } catch (e) {
      const status = e?.status || e?.response?.status
      if (status === 401) {
        message.error('密码错误，已终止导入')
        aborted = true
        break
      }
      fail++
    }
  }
  return { ok, fail, aborted }
}

function openImport() {
  if (!importAllScope.value && (!Array.isArray(scope.value) || scope.value.length === 0)) {
    message.warning('请选择生效域或勾选使用 ALL')
    return
  }
  showPwd.value = true
}

async function doImport(password) {
  importing.value = true
  try {
    const { data } = await fetchCompYearPairs(importYear.value)
    const pairs = Array.isArray(data?.pairs) ? data.pairs : []
    if (pairs.length === 0) { message.warning('该年无调休数据'); return }
    const scopePayload = buildImportScope()
    const { ok, fail, aborted } = await processImportPairs(pairs, scopePayload, password)
    if (ok > 0) {
      const failPart = fail > 0 ? '，失败 ' + fail + ' 条' : ''
      message.success('已导入 ' + ok + ' 条' + failPart)
    } else if (!aborted) {
      message.error('导入失败')
    }
    if (ok > 0 && !aborted) showPwd.value = false
  } catch (e) {
    if (!e?.response?.status) console.error(e)
  } finally {
    importing.value = false
  }
}

const disabledOptions = [...scope.value]
const computedScopeOptions = scopeSelectOptions.value.map(o => ({
  label: o.label,
  value: o.value,
  disabled: disabledOptions.includes(o.value)
}))
</script>

<template>
  <n-card title="导入全年调休" :bordered="false">
    <n-form label-placement="left" label-width="120">
      <n-form-item label="年份">
        <n-input-number v-model:value="importYear" :show-button="false" :min="1970" :max="2100" />
      </n-form-item>
      <n-form-item label="生效域">
        <n-select v-model:value="scope" multiple tag :options="computedScopeOptions" placeholder="选择生效范围，可多选" @update:value="onScopeChange" />
      </n-form-item>
      <n-form-item label="使用 ALL">
        <n-select v-model:value="importAllScope" :options="[{ label: '是（推荐）', value: true }, { label: '否（使用上方生效域）', value: false }]" />
      </n-form-item>
      <n-form-item>
        <n-button type="primary" :loading="importing" @click="openImport">开始导入</n-button>
      </n-form-item>
    </n-form>

    <div style="font-size:12px;color:#888;margin-top:12px;">将按调休数据中的 workday 作为 date、holiday 作为 useDate 创建调休任务，并逐条提交到服务端。</div>
  </n-card>

  <confirm-password-modal
    :loading="importing"
    :show="showPwd"
    confirm-text="开始导入"
    title="导入全年调休"
    @confirm="doImport"
    @update:show="val => showPwd = val"
  />
</template>

<style scoped>
/* compensation import */
</style>
