<script setup>
import {h, ref, watch} from 'vue'
import {NButton, NCard, NDataTable, NInput, NSpace, useMessage} from 'naive-ui'
import {useRequest} from 'vue-request'
import {useRouter} from 'vue-router'
import ScopeTags from '@/components/ScopeTags.vue'
import ConfirmPasswordModal from '@/components/ConfirmPasswordModal.vue'
import {deleteCountdown, listCountdown} from '@/api/countdown.js'

const router = useRouter()
const message = useMessage()

const rows = ref([])
const keyword = ref('')

const {run, loading} = useRequest(listCountdown, {
  manual: false,
  onSuccess: (res) => {
    rows.value = Array.isArray(res?.data) ? res.data : []
    applyFilter()
  },
  onError: (e) => {
    console.error('[countdown] 获取失败', e)
    rows.value = []
    applyFilter()
  }
})

const showDelete = ref(false)
const deleting = ref(false)
const deleteId = ref('')

function askDelete(row) {
  deleteId.value = row.id
  showDelete.value = true
}

async function doDelete(password) {
  if (!deleteId.value) return
  deleting.value = true
  try {
    await deleteCountdown(deleteId.value, password)
    message.success('已删除')
    showDelete.value = false
    deleteId.value = ''
    run()
  } catch (e) {
    const status = e?.status || e?.response?.status
    if (status === 401) message.error('你寻思寻思这密码它对吗？')
    else message.error(`删除失败（状态码：${status ?? '未知'}）`)
  } finally {
    deleting.value = false
  }
}

function goAdd() {
  router.push('/countdown/add')
}

function onEdit(row) {
  router.push(`/countdown/edit/${row.id}`)
}

const columns = [
  {title: '唯一ID', key: 'id', ellipsis: {tooltip: true}},
  {title: '生效域', key: 'scope', render: (row) => h(ScopeTags, {scopes: row.scope})},
  {
    title: '日程数量',
    key: 'count',
    width: 100,
    align: 'center',
    render: (row) => String(Array.isArray(row.schedules) ? row.schedules.length : 0)
  },
  {
    title: '预览',
    key: 'preview',
    ellipsis: {tooltip: true},
    render: (row) => {
      const list = Array.isArray(row.schedules) ? row.schedules : []
      if (list.length === 0) return '（空）'
      return list.slice(0, 3).map(it => `${it.name}(${it.date},P${it.priority ?? 0})`).join('；')
    }
  },
  {
    title: '快捷操作',
    key: 'actions',
    width: 180,
    align: 'center',
    render: (row) => h(NSpace, {justify: 'center'}, {
      default: () => [
        h(NButton, {size: 'small', tertiary: true, onClick: () => onEdit(row)}, {default: () => '修改'}),
        h(NButton, {
          size: 'small',
          tertiary: true,
          type: 'error',
          onClick: () => askDelete(row)
        }, {default: () => '删除'})
      ]
    })
  }
]

const filteredRows = ref([])

function applyFilter() {
  const k = String(keyword.value || '').trim()
  if (!k) {
    filteredRows.value = rows.value
    return
  }
  filteredRows.value = rows.value.filter((r) => {
    if (String(r.id || '').includes(k)) return true
    const list = Array.isArray(r.schedules) ? r.schedules : []
    return list.some(it => String(it.name || '').includes(k) || String(it.date || '').includes(k))
  })
}

function refresh() {
  run()
}

watch(keyword, () => {
  applyFilter()
})
</script>

<template>
  <n-card :bordered="false" title="倒数日配置">
    <template #header-extra>
      <n-space>
        <n-input v-model:value="keyword" clearable placeholder="按 ID/名称/日期筛选" style="width: 220px"
                 @update:value="applyFilter"/>
        <n-button size="small" @click="goAdd">新增</n-button>
        <n-button :loading="loading" size="small" @click="refresh">刷新</n-button>
      </n-space>
    </template>

    <n-data-table :columns="columns" :data="filteredRows" :loading="loading" :pagination="false"/>

    <confirm-password-modal
        :loading="deleting"
        :show="showDelete"
        confirm-text="确认删除"
        title="删除倒数日配置"
        @confirm="doDelete"
        @update:show="val => showDelete = val"
    />
  </n-card>
</template>
