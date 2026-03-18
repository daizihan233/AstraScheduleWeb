<script setup>
import {computed, reactive, ref} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useRequest} from 'vue-request'
import {
  NButton,
  NCard,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  useMessage
} from 'naive-ui'
import ConfirmPasswordModal from '@/components/ConfirmPasswordModal.vue'
import {applyDisabledToScopeOptions, normalizeScopes} from '@/utils/scope.js'
import {fetchScopeTree, flattenScope, getCountdown, saveCountdown} from '@/api/countdown.js'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const isEdit = computed(() => !!route.params.id)
const title = computed(() => isEdit.value ? '编辑倒数日配置' : '新增倒数日配置')

const form = reactive({
  id: '',
  scope: [],
  schedules: [
    {name: '', date: null, priority: 0}
  ]
})

function setFormFromData(d) {
  form.id = d.id
  form.scope = Array.isArray(d.scope) ? d.scope.slice() : []
  form.schedules = (Array.isArray(d.schedules) ? d.schedules : []).map(it => ({
    name: String(it.name || ''),
    date: String(it.date || ''),
    priority: Number(it.priority || 0)
  }))
  if (form.schedules.length === 0) {
    form.schedules.push({name: '', date: null, priority: 0})
  }
}

const scopeSelectOptions = ref([])
useRequest(fetchScopeTree, {
  manual: false,
  onSuccess: (res) => {
    scopeSelectOptions.value = flattenScope(res?.data || [])
  },
  onError: (e) => {
    console.warn('[scope] 获取失败', e);
    scopeSelectOptions.value = []
  }
})

const computedScopeOptions = computed(() => applyDisabledToScopeOptions(scopeSelectOptions.value, form.scope))

if (isEdit.value) {
  useRequest(() => getCountdown(route.params.id), {
    manual: false,
    onSuccess: (res) => {
      const d = res?.data
      if (!d) {
        message.error('记录不存在')
        router.push('/countdown')
        return
      }
      setFormFromData(d)
    },
    onError: (e) => {
      message.error('读取失败')
      console.error(e)
    }
  })
}

function addItem() {
  form.schedules.push({name: '', date: null, priority: 0})
}

function removeItem(index) {
  form.schedules.splice(index, 1)
  if (form.schedules.length === 0) {
    form.schedules.push({name: '', date: null, priority: 0})
  }
}

function onScopeChange(v) {
  form.scope = normalizeScopes(v)
}

function validate() {
  if (!Array.isArray(form.scope) || form.scope.length === 0) {
    message.warning('请选择生效域')
    return false
  }
  const normalized = form.schedules
      .map(it => ({
        name: String(it.name || '').trim(),
        date: String(it.date || '').trim(),
        priority: Number(it.priority || 0)
      }))
      .filter(it => it.name && it.date)
  if (normalized.length === 0) {
    message.warning('请至少填写一条完整日程')
    return false
  }
  for (const it of normalized) {
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(it.date)) {
      message.warning(`日期格式错误：${it.date}（需要 YYYY-MM-DD）`)
      return false
    }
  }
  return true
}

const showPwd = ref(false)
const saving = ref(false)

function openSave() {
  if (!validate()) return
  showPwd.value = true
}

async function confirmSave(password) {
  saving.value = true
  try {
    const payload = {
      id: isEdit.value ? form.id : undefined,
      scope: form.scope,
      schedules: form.schedules
          .map(it => ({
            name: String(it.name || '').trim(),
            date: String(it.date || '').trim(),
            priority: Number(it.priority || 0)
          }))
          .filter(it => it.name && it.date)
    }
    await saveCountdown(payload, password)
    message.success('已保存')
    showPwd.value = false
    await router.push('/countdown')
  } catch (e) {
    const status = e?.status || e?.response?.status
    if (status === 401) message.error('你寻思寻思这密码它对吗？')
    else if (status === 400) message.error(e?.response?.data?.detail || '参数校验失败')
    else message.error(`保存失败（状态码：${status ?? '未知'}）`)
  } finally {
    saving.value = false
  }
}

function onCancel() {
  router.back()
}
</script>

<template>
  <n-card :bordered="false" :title="title">
    <n-form :model="form" label-placement="left" label-width="100">
      <n-form-item v-if="isEdit" label="唯一ID">
        <n-input v-model:value="form.id" disabled/>
      </n-form-item>

      <n-form-item label="生效域">
        <n-select
            v-model:value="form.scope"
            :options="computedScopeOptions"
            multiple
            placeholder="选择生效范围，可多选"
            tag
            @update:value="onScopeChange"
        />
      </n-form-item>

      <n-form-item label="日程列表">
        <n-space style="width: 100%" vertical>
          <n-card
              v-for="(item, index) in form.schedules"
              :key="index"
              :title="`日程 ${index + 1}`"
              size="small"
          >
            <n-space style="width: 100%" vertical>
              <n-form-item label="名称">
                <n-input v-model:value="item.name" placeholder="例如：期末考试"/>
              </n-form-item>
              <n-form-item label="日期">
                <n-date-picker v-model:formatted-value="item.date" type="date" value-format="yyyy-MM-dd"/>
              </n-form-item>
              <n-form-item label="优先级">
                <n-input-number v-model:value="item.priority" :show-button="false"/>
              </n-form-item>
              <n-button tertiary type="error" @click="removeItem(index)">删除该条</n-button>
            </n-space>
          </n-card>

          <n-button dashed type="primary" @click="addItem">+ 增加日程</n-button>
        </n-space>
      </n-form-item>

      <n-form-item>
        <n-space>
          <n-button :loading="saving" type="primary" @click="openSave">保存</n-button>
          <n-button tertiary @click="onCancel">取消</n-button>
        </n-space>
      </n-form-item>
    </n-form>
  </n-card>

  <confirm-password-modal
      :loading="saving"
      :show="showPwd"
      confirm-text="确认保存"
      title="保存倒数日"
      @confirm="confirmSave"
      @update:show="val => showPwd = val"
  />
</template>
