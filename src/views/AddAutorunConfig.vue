<script setup>
import {computed, reactive, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useRequest} from 'vue-request'
import axios from 'axios'
import {APISRV} from '@/global.js'
import {
  NButton,
  NCard,
  NDatePicker,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  NText,
  useMessage
} from 'naive-ui'
import {
  AutorunType,
  autorunTypeOptions,
  fetchClassScheduleTemplateByWeekday,
  fetchCompByHoliday,
  fetchCompByWorkday,
  fetchScopeTree,
  fetchSubjectsOptions,
  fetchTimetableOptions,
  flattenScope,
  getTask,
  saveAutorun
} from '@/api/autorun.js'
import {applyDisabledToScopeOptions, findNodeByValue, normalizeScopes, parseGradePairsFromScopes} from '@/utils/scope.js'
import ConfirmPasswordModal from '@/components/ConfirmPasswordModal.vue'

// ============================================================
// 共用：作用域树
// ============================================================
const scopeSelectOptions = ref([])
const scopeTreeRef = ref([])
useRequest(fetchScopeTree, {
  manual: false,
  onSuccess: (res) => { scopeSelectOptions.value = flattenScope(res?.data || []); scopeTreeRef.value = res?.data || [] },
  onError: (e) => { console.warn('[scope] 获取失败', e); scopeSelectOptions.value = []; scopeTreeRef.value = [] }
})

const route = useRoute()
const router = useRouter()
const message = useMessage()

const isEdit = computed(() => !!route.params.id)
const title = computed(() => isEdit.value ? '编辑自动任务' : '新增自动任务')

const formRef = ref(null)
const form = reactive({
  id: '',
  type: AutorunType.COMPENSATION,
  scope: [],
  priority: 0,
  content: {date: null, useDate: null, timetableId: '', schedule: {periods: []}}
})

// ============================================================
// 工具函数
// ============================================================
function toCount(rawNeed) {
  const n = Number(rawNeed)
  if (!Number.isFinite(n)) return 0
  return n < 0 ? 0 : n + 1
}

function pickSchoolGrade(selected) {
  const arr = Array.isArray(selected) ? selected : []
  const clsVal = arr.find(v => v && v.split('/').length >= 3)
  if (clsVal) {
    const [school, grade, cls] = clsVal.split('/')
    return {school, grade, cls}
  }
  const gradeVal = arr.find(v => v && v.split('/').length === 2)
  if (gradeVal) {
    const [school, grade] = gradeVal.split('/');
    return {school, grade}
  }
  const schoolVal = arr.find(v => v && v.split('/').length === 1)
  if (schoolVal){
    const node = findNodeByValue(scopeTreeRef.value, schoolVal)
    const firstGrade = (node?.children || []).find(n => n.value && n.value.split('/').length === 2)
    if (firstGrade) {
      const [school, grade] = firstGrade.value.split('/');
      return {school, grade}
    }
  }
  return null
}

function collectClassesFromScopes(scopes) {
  const result = []
  const seen = new Set()
  const arr = Array.isArray(scopes) ? scopes : []
  for (const v of arr) {
    if (!v) continue
    const parts = String(v).split('/').filter(Boolean)
    if (parts.length >= 3) {
      const [school, grade, cls] = parts
      const value = [school, grade, cls].join('/')
      if (!seen.has(value)) {
        result.push({school, grade, cls, value});
        seen.add(value)
      }
    } else if (parts.length === 2) {
      const gradeNode = findNodeByValue(scopeTreeRef.value, v)
      const classes = Array.isArray(gradeNode?.children) ? gradeNode.children : []
      for (const c of classes) {
        const pv = String(c.value || '')
        const [school, grade, cls] = pv.split('/').filter(Boolean)
        if (!school || !grade || !cls) continue
        if (!seen.has(pv)) {
          result.push({school, grade, cls, value: pv});
          seen.add(pv)
        }
      }
    } else if (parts.length === 1) {
      const schoolNode = findNodeByValue(scopeTreeRef.value, v)
      const grades = Array.isArray(schoolNode?.children) ? schoolNode.children : []
      for (const g of grades) {
        const classes = Array.isArray(g?.children) ? g.children : []
        for (const c of classes) {
          const pv = String(c.value || '')
          const [school, grade, cls] = pv.split('/').filter(Boolean)
          if (!school || !grade || !cls) continue
          if (!seen.has(pv)) {
            result.push({school, grade, cls, value: pv});
            seen.add(pv)
          }
        }
      }
    }
  }
  return result
}

function intersectTimetableOptions(results) {
  let intersect = null
  const labelMap = new Map()
  for (const r of results) {
    const values = new Set((r.options || []).map(o => o.value))
    for (const o of (r.options || [])) {
      if (!labelMap.has(o.value)) labelMap.set(o.value, o.label)
    }
    if (intersect === null) intersect = values
    else intersect = new Set([...intersect].filter(v => values.has(v)))
  }
  return [...(intersect || new Set())].map(v => ({label: labelMap.get(v) || String(v), value: v}))
}

// ============================================================
// SCHEDULE/ALL 数据：作息表 & 学科 & 节次检测
// ============================================================
const timetableOpts = ref([])
const subjectsOpts = ref([])
const needByValueMap = computed(() => new Map(timetableOpts.value.map(o => [o.value, Number(o.need) || 0])))
const needByLabelMap = ref(new Map())

const detectedNeedRaw = ref(null)
const detectedTimetableId = ref('')
const detectedTimetableLabel = computed(() => {
  const opt = timetableOpts.value.find(o => o.value === detectedTimetableId.value)
  return opt ? opt.label : ''
})
const isRestDay = computed(() => detectedNeedRaw.value !== null && toCount(detectedNeedRaw.value) === 0)

async function loadGradeOptions() {
  const pair = pickSchoolGrade(form.scope)
  if (!pair) {
    timetableOpts.value = [];
    subjectsOpts.value = [];
    needByLabelMap.value = new Map();
    return
  }
  const [{options, needMap: labelNeedMap}, {options: subs}] = await Promise.all([
    fetchTimetableOptions(pair.school, pair.grade),
    fetchSubjectsOptions(pair.school, pair.grade)
  ])
  timetableOpts.value = options
  needByLabelMap.value = labelNeedMap instanceof Map ? labelNeedMap : new Map(options.map(o => [o.label, Number(o.need) || 0]))
  subjectsOpts.value = subs
  if (form.type === AutorunType.ALL && !form.content.timetableId && timetableOpts.value.length > 0) {
    form.content.timetableId = timetableOpts.value[0].value
  }
}

function periodCountOf(type, timetableId, schedule) {
  if (type === AutorunType.ALL) {
    const needById = needByValueMap.value.get(timetableId)
    if (needById !== undefined) return toCount(needById)
    if (detectedNeedRaw.value !== null) return toCount(detectedNeedRaw.value)
    return 0
  }
  if (detectedNeedRaw.value !== null) return toCount(detectedNeedRaw.value)
  if (Array.isArray(schedule?.periods) && schedule.periods.length > 0) return schedule.periods.length
  return timetableOpts.value.length > 0 ? toCount(Number(timetableOpts.value[0].need) || 0) : 0
}

const periodCount = computed(() => periodCountOf(form.type, form.content.timetableId, form.content.schedule))

watch(periodCount, (n) => {
  if (form.type !== AutorunType.SCHEDULE && form.type !== AutorunType.ALL) return
  if (n <= 0) { form.content.schedule.periods = []; return }
  const arr = form.content.schedule.periods.slice(0, n)
  while (arr.length < n) arr.push({no: arr.length + 1, subject: ''})
  for (let idx = 0; idx < arr.length; idx++) {
    arr[idx].no = idx + 1
  }
  form.content.schedule.periods = arr
})

watch(() => form.content.date, () => {
  detectedNeedRaw.value = null
  detectedTimetableId.value = ''
})

// ============================================================
// TIMETABLE 数据：按 scope 动态拉取作息表交集
// ============================================================
const timetableOptionsDyn = ref([])
const timetableLoading = ref(false)
const timetableHint = ref('')

async function refreshTimetableOptions() {
  timetableHint.value = ''
  timetableOptionsDyn.value = []
  if (form.type !== AutorunType.TIMETABLE) return
  const pairs = parseGradePairsFromScopes(form.scope)
  if (pairs.length === 0) {
    timetableHint.value = '请选择具体年级/班级作为生效域以获取作息表选项';
    return
  }
  timetableLoading.value = true
  try {
    const results = await Promise.allSettled(pairs.map(p => fetchTimetableOptions(p.school, p.grade)))
    const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value)
    if (ok.length === 0) {
      timetableHint.value = '未获取到任何作息表选项'
      timetableOptionsDyn.value = []
    } else {
      const list = intersectTimetableOptions(ok)
      timetableOptionsDyn.value = list
      if (list.length === 0) timetableHint.value = '所选多个年级没有共同的作息表选项，请调整生效域'
      if (form.content.timetableId && !list.some(o => o.value === form.content.timetableId)) form.content.timetableId = ''
    }
  } catch (e) {
    console.warn('[timetable options] 获取失败', e)
    timetableHint.value = '获取作息表选项失败'
    timetableOptionsDyn.value = []
  } finally {
    timetableLoading.value = false
  }
}

watch(() => [form.type, JSON.stringify(form.scope)], () => {
  refreshTimetableOptions()
})

// ============================================================
// COMPENSATION：自动反推 & 批量导入
// ============================================================
const autoFilling = ref(false)
async function fillWorkdayFromHoliday(){
  const holiday = form.content.useDate
  if(!holiday) return
  autoFilling.value = true
  try{
    const { data } = await fetchCompByHoliday(holiday)
    const wd = data?.compensation
    if (wd) form.content.date = wd
  } finally { autoFilling.value = false }
}
async function fillHolidayFromWorkday(){
  const workday = form.content.date
  if(!workday) return
  autoFilling.value = true
  try{
    const { data } = await fetchCompByWorkday(workday)
    const hd = data?.compensation
    if (hd) form.content.useDate = hd
  } finally { autoFilling.value = false }
}
watch(()=>[form.type, form.content.date, form.content.useDate], ([t, d, u])=>{
  if (t !== AutorunType.COMPENSATION) return
  if (u && !d) fillWorkdayFromHoliday()
  else if (d && !u) fillHolidayFromWorkday()
})

// ============================================================
// SCHEDULE/ALL 自动填充
// ============================================================
const scheduleAutoFilling = ref(false)
const showConflict = ref(false)
const conflictMsg = ref('')

async function autoFillSchedule() {
  const date = form.content.date
  if (!date) {
    message.warning('请选择日期');
    return
  }
  const classList = collectClassesFromScopes(form.scope)
  if (!Array.isArray(classList) || classList.length === 0) {
    message.warning('请选择包含班级的生效域');
    return
  }
  scheduleAutoFilling.value = true
  try {
    const weekday = new Date(date).getDay()
    const results = await Promise.allSettled(classList.map(c => fetchClassScheduleTemplateByWeekday({
      school: c.school,
      grade: c.grade,
      cls: c.cls,
      weekday
    })))
    const ok = []
    for (let idx = 0; idx < results.length; idx++) {
      const r = results[idx]
      if (r.status === 'fulfilled') {
        const data = r.value?.data || {}
        const periods = Array.isArray(data.periods) ? data.periods : []
        const timetableLabel = String(data.timetableLabel || '')
        const needRaw = timetableLabel ? Number(needByLabelMap.value.get(timetableLabel)) : -1
        const option = timetableLabel ? timetableOpts.value.find(o => o.label === timetableLabel) : null
        ok.push({cls: classList[idx], periods, timetableLabel, needRaw, option})
      }
    }
    if (ok.length === 0) {
      message.error('未能获取到任何班级的课程模板');
      return
    }
    const counts = new Set(ok.map(x => toCount(x.needRaw)))
    if (counts.size > 1) {
      const detail = ok
          .map(x => x.cls.value + '：作息表"' + (x.timetableLabel || '未知') + '" -> ' + toCount(x.needRaw) + ' 节')
          .join('\n')
      conflictMsg.value = '所选作用域内不同班级在该日的作息表节次数不一致，无法自动填充：\n' + detail
      showConflict.value = true
      return
    }
    const pickIdx = Math.floor(Math.random() * ok.length)
    const chosen = ok[pickIdx]
    form.content.schedule.periods = chosen.periods.map((p, idx) => ({
      no: Number(p.no) || idx + 1,
      subject: String(p.subject || '')
    }))
    const needRaw = Number.isFinite(chosen.needRaw) ? chosen.needRaw : -1
    detectedNeedRaw.value = needRaw
    if (chosen.option) {
      detectedTimetableId.value = chosen.option.value
      if (form.type === AutorunType.ALL) {
        form.content.timetableId = chosen.option.value
      }
    } else {
      detectedTimetableId.value = ''
      if (form.type === AutorunType.ALL) {
        message.warning('未能从班级配置中识别出当日作息表，请手动选择作息表');
      }
    }
    message.success('已按班级 ' + chosen.cls.value + ' 自动填充，并基于"' + (chosen.timetableLabel || '未知') + '"作息表（' + toCount(needRaw) + ' 节）调整表单')
  } finally {
    scheduleAutoFilling.value = false
  }
}

// ============================================================
// setFormFromData —— 严格保持原版逻辑
// ============================================================
function setFormFromData(d) {
  form.id = d.id
  form.type = d.type
  form.scope = Array.isArray(d.scope) ? d.scope.slice() : []
  form.priority = d.priority || 0
  const c = d.content || {}
  if (form.type === AutorunType.COMPENSATION || form.type === AutorunType.TIMETABLE) {
    // ——— 原版 AddAutorunConfig 行为 ———
    form.content = { date: c.date || null, useDate: c.useDate || null, timetableId: c.timetableId || '' }
  } else {
    // ——— 原版 AddAutorunSchedule 行为 ———
    form.content.date = c.date || null
    form.content.timetableId = c.timetableId || ''
    form.content.schedule.periods = Array.isArray(c.schedule?.periods)
      ? c.schedule.periods.map(p => ({ no: Number(p.no)||0, subject: String(p.subject||'') }))
      : []
  }
}

const { run: runGet, loading: loadingGet } = useRequest(() => getTask(route.params.id), {
  manual: true,
  onSuccess: (resp) => { const d = resp?.data; if (d) setFormFromData(d) },
  onError: (e) => { message.error('读取失败'); console.error(e) }
})
if (isEdit.value) runGet()

// ============================================================
// 作用域变更 —— 严格保持原版逻辑
// ============================================================
function onScopeChange(v) {
  form.scope = normalizeScopes(v)
  if (form.type === AutorunType.SCHEDULE || form.type === AutorunType.ALL) {
    // ——— 原版 AddAutorunSchedule 行为 ———
    detectedNeedRaw.value = null
    detectedTimetableId.value = ''
    loadGradeOptions()
  }
}

watch(() => form.scope.slice(), () => {
  if (form.type === AutorunType.SCHEDULE || form.type === AutorunType.ALL) {
    detectedNeedRaw.value = null
    detectedTimetableId.value = ''
    loadGradeOptions()
  }
})
watch(() => [form.type, form.content.timetableId], () => {
  if (form.type === AutorunType.ALL) loadGradeOptions()
})

// ============================================================
// 验证 —— 严格保持原版逻辑
// ============================================================
function validate() {
  if (!Array.isArray(form.scope) || form.scope.length === 0) { message.warning('请选择生效域'); return false }
  if (form.type === AutorunType.COMPENSATION) {
    // ——— 原版 AddAutorunConfig 行为 ———
    if (!form.content.date || !form.content.useDate) {
      message.warning('请完整填写调休日与被借用的上课日期');
      return false
    }
  } else if (form.type === AutorunType.TIMETABLE) {
    // ——— 原版 AddAutorunConfig 行为 ———
    if (!form.content.date || !form.content.timetableId) { message.warning('请完整填写日期与作息表'); return false }
    if (timetableLoading.value === false && timetableOptionsDyn.value.length === 0) {
      message.warning('未找到可用作息表，请选择具体年级/班级作为生效域');
      return false
    }
  } else {
    // ——— 原版 AddAutorunSchedule validateSchedule 行为 ———
    if (!form.content.date) { message.warning('请选择日期'); return false }
    if (form.type === AutorunType.ALL && !form.content.timetableId) { message.warning('请选择作息表'); return false }
    const n = periodCountOf(form.type, form.content.timetableId, form.content.schedule)
    if (n === 0) {
      form.content.schedule.periods = []
      return true
    }
    if (n < 0) {
      message.warning('当前作息表无节次');
      return false
    }
    const list = form.content.schedule?.periods || []
    if (!Array.isArray(list) || list.length !== n) { message.warning('节次数与作息表不一致'); return false }
    for (const item of list) {
      if (!item || !item.subject || String(item.subject).trim() === '') {
        message.warning('请为每一节选择科目');
        return false
      }
    }
  }
  return true
}

// ============================================================
// 保存 —— 严格保持原版逻辑
// ============================================================
const saving = ref(false)
const showPwd = ref(false)
function openSave() {
  if (!validate()) return
  showPwd.value = true
}
function onCancel() { router.back() }

async function confirmSave(pwd) {
  saving.value = true
  try {
    let content
    if (form.type === AutorunType.COMPENSATION || form.type === AutorunType.TIMETABLE) {
      // ——— 原版 AddAutorunConfig 行为：{ ...form.content } ———
      content = { date: form.content.date, useDate: form.content.useDate, timetableId: form.content.timetableId }
    } else {
      // ——— 原版 AddAutorunSchedule 行为 ———
      content = {
        date: form.content.date,
        timetableId: form.type === AutorunType.ALL ? form.content.timetableId : undefined,
        schedule: { periods: form.content.schedule.periods.map(p => ({ no: Number(p.no)||0, subject: String(p.subject||'') })) }
      }
    }
    const payload = { type: form.type, scope: form.scope, priority: form.priority, content }
    if (isEdit.value && form.id) {
      await axios.delete(`${APISRV}/web/autorun/${form.id}`, {
        auth: {username: 'ElectronClassSchedule', password: pwd}
      })
    }
    await saveAutorun(payload, pwd)
    message.success('已保存')
    showPwd.value = false
    await router.push('/autorun')
  } catch(e){
    const status = e?.status || e?.response?.status
    if (status === 401) message.error('你寻思寻思这密码它对吗？')
    else if (status === 400) message.error('码姿不对，删了重写！（服务端校验不通过）')
    else message.error('服务端看完天塌了（状态码：' + (status ?? '未知') + '）')
  } finally { saving.value = false }
}

const computedScopeOptions = computed(() => applyDisabledToScopeOptions(scopeSelectOptions.value, form.scope))
</script>

<template>
  <n-card :title="title" :bordered="false">
    <n-form ref="formRef" :model="form" label-placement="left" label-width="100">

    <n-form-item v-if="isEdit" label="唯一ID">
        <n-input v-model:value="form.id" disabled />
      </n-form-item>
      <n-form-item label="类型">
        <n-select v-model:value="form.type" :options="autorunTypeOptions" />
      </n-form-item>

      <n-form-item v-if="form.type === AutorunType.COMPENSATION">
        <n-space>
          <n-button size="small" @click="router.push('/tools/compensation-import')">导入全年调休</n-button>
          <n-button size="small" :loading="autoFilling" @click="fillWorkdayFromHoliday" :disabled="!form.content.useDate">由节假日反推工作日</n-button>
          <n-button size="small" :loading="autoFilling" @click="fillHolidayFromWorkday" :disabled="!form.content.date">由工作日反推节假日</n-button>
        </n-space>
      </n-form-item>

      <n-form-item label="生效域">
        <n-select v-model:value="form.scope" multiple tag :options="computedScopeOptions" placeholder="选择生效范围，可多选" @update:value="onScopeChange" />
      </n-form-item>
      <n-form-item label="优先级">
        <n-input-number v-model:value="form.priority" :show-button="false" placeholder="执行顺序（数字）" />
      </n-form-item>

      <n-divider>类型相关参数</n-divider>

      <template v-if="form.type === AutorunType.COMPENSATION">
        <n-form-item label="工作日 (date)">
          <n-date-picker v-model:formatted-value="form.content.date" type="date" value-format="yyyy-MM-dd" />
        </n-form-item>
        <n-form-item label="节假日 (useDate)">
          <n-date-picker v-model:formatted-value="form.content.useDate" type="date" value-format="yyyy-MM-dd" />
        </n-form-item>
      </template>
      <template v-else-if="form.type === AutorunType.TIMETABLE">
        <n-form-item label="调整日期">
          <n-date-picker v-model:formatted-value="form.content.date" type="date" value-format="yyyy-MM-dd" />
        </n-form-item>
        <n-form-item label="作息表">
          <n-select v-model:value="form.content.timetableId" :loading="timetableLoading" :options="timetableOptionsDyn"
                    placeholder="先选择包含年级/班级的生效域后再选择作息表"/>
          <div v-if="timetableHint" style="font-size:12px;color:#888;margin-top:6px;">{{ timetableHint }}</div>
        </n-form-item>
      </template>
      <template v-else>
        <n-form-item v-if="form.type === AutorunType.ALL" label="作息表（ALL 专用）">
          <n-select v-model:value="form.content.timetableId" :options="timetableOpts.map(o=>({ label:o.label, value:o.value }))" placeholder="请选择作息表" />
        </n-form-item>
        <n-form-item label="对应日期">
          <n-date-picker v-model:formatted-value="form.content.date" type="date" value-format="yyyy-MM-dd" />
          <n-button size="small" style="margin-left:8px" :loading="scheduleAutoFilling" @click="autoFillSchedule">自动填充</n-button>
          <n-text v-if="detectedNeedRaw !== null && !detectedTimetableLabel" depth="3" style="margin-left:8px;">
            已检测到节次数：{{ toCount(detectedNeedRaw) }}（无法唯一匹配作息表）
          </n-text>
          <n-text v-if="detectedNeedRaw !== null && detectedTimetableLabel" depth="3" style="margin-left:8px;">
            已检测到当日作息表：{{ detectedTimetableLabel }}（共 {{ toCount(detectedNeedRaw) }} 节）
          </n-text>
        </n-form-item>
        <n-form-item label="课程表（节次/科目）">
          <n-card size="small" style="width:100%" :bordered="true">
            <n-space vertical style="width:100%">
              <n-text v-if="periodCount===0" depth="3">{{
                  isRestDay ? '检测到休息日，无需填写课程' : '请先选择作息表或等待模板加载'
                }}
              </n-text>
              <div v-for="i in periodCount" :key="i" style="display:flex; align-items:center; gap:12px; width:100%">
                <div style="width:60px; text-align:right;">第 {{ i }} 节</div>
                <n-select v-model:value="form.content.schedule.periods[i-1].subject" :options="subjectsOpts" placeholder="选择科目" style="flex:1;" />
              </div>
            </n-space>
          </n-card>
        </n-form-item>
      </template>

      <n-form-item>
        <n-space>
          <n-button type="primary" :loading="saving || loadingGet" @click="openSave">保存</n-button>
          <n-button tertiary @click="onCancel">取消</n-button>
        </n-space>
      </n-form-item>
    </n-form>
  </n-card>

  <n-modal v-model:show="showConflict" preset="dialog" title="节次数冲突">
    <n-space vertical>
      <div style="white-space: pre-line;">{{ conflictMsg }}</div>
      <div style="font-size:12px;color:#888">请调整生效域使其落到节次数一致的班级集合，或单选一个具体班级。</div>
    </n-space>
  </n-modal>

  <confirm-password-modal
      :loading="saving"
      :show="showPwd"
      confirm-text="确认保存"
      title="保存"
      @confirm="confirmSave"
      @update:show="val=> showPwd = val"
  />
</template>

<style scoped>
/* autorun form */
</style>
