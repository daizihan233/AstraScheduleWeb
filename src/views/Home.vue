<script setup>
import {useRequest} from 'vue-request';
import {
  NButton,
  NCard,
  NDataTable,
  NFlex,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NStatistic,
  NTag,
  NText,
  useMessage,
  useThemeVars
} from 'naive-ui';
import axios from 'axios';
import {computed, h, reactive, ref, watch} from "vue";
import gsap from 'gsap';
import {APISRV} from '../global.js'

const columns = [
  {
      title: '班级',
      key: 'name',
      defaultSortOrder: false,
      sorter: 'default'
  },
  {
      title: '连接状态',
      key: 'status',
      defaultSortOrder: false,
      sorter: 'default',
      render(row) {
          return h(
                NTag,
                {
                    style: {
                        marginRight: '6px'
                    },
                    type: row.status === '已断开连接' ? "error" : 'success',
                    bordered: false
                },
                {
                    default: () => row.status
                }
            )

      }
  },
  {
      title: '今日异常断连次数',
      key: 'disconnect',
      defaultSortOrder: false,
      sorter: (row1, row2) => row1.disconnect - row2.disconnect
  }
]
const getStatistic = () => axios.get(`${APISRV}/web/statistic`);
const statInfo = reactive(
    {
        "weather_error":0,
        "websocket_disconnect":{},
        "clients":[],
        "websocket_disconnect_count": 0,
        "clients_count": 0
    }
);

let statTable = ref([]);
// noinspection JSCheckFunctionSignatures
useRequest(
    getStatistic,
    {
      pollingInterval: 1000,
      initialData: {
          "weather_error": 0,
          "websocket_disconnect": {},
          "clients": [],
          "websocket_disconnect_count": 0,
          "clients_count": 0
      },
      onSuccess: (response) => {
        let statMap = {};
        statTable.value = []
        console.log(response.data);
        gsap.to(statInfo, {
          "weather_error": response.data["weather_error"],
          "websocket_disconnect": response.data["websocket_disconnect_count"],
          "clients": response.data["clients_count"]
        });
        // noinspection JSCheckFunctionSignatures
        for (let [key, value] of Object.entries(response.data["websocket_disconnect"])) {
            statMap[key] = ["已断开连接", value];
        }
        for (let [, name] of Object.entries(response.data["clients"])) {
            if (statMap[name])
                statMap[name][0] = "保持连接";
            else
                statMap[name] = ["保持连接", 0];
        }
        for (let [keys, value] of Object.entries(statMap)) {
            statTable.value.push(
                {
                    key: keys,
                    name: keys,
                    status: value[0],
                    disconnect: value[1]
                }
            )
        }
        console.log(statTable);
      }
    }
);
const weatherError = computed(() => {
    return Number.parseInt(statInfo.weather_error).toLocaleString();
});
const wsDisconnect = computed(() => {
    return Number.parseInt(statInfo.websocket_disconnect).toLocaleString();
});
const clientsCount = computed(() => {
    // noinspection JSCheckFunctionSignatures
    return Number.parseInt(statInfo.clients).toLocaleString();
});
useThemeVars();

const message = useMessage();

// -------------------- 配置复制（复制自...） --------------------
const structureData = ref([]);
const copyPwd = ref('');
const showCopyModal = ref(false);
const copyLoading = ref(false);
const copyForm = reactive({
  fromSchool: '',
  fromGrade: '',
  fromClass: '',
  toSchool: '',
  toGrade: '',
  toClass: ''
});

const getStructure = () => axios.get(`${APISRV}/web/structure`);
useRequest(getStructure, {
  initialData: [],
  onSuccess: (response) => {
    structureData.value = Array.isArray(response.data) ? response.data : [];
  }
});

function getSchoolNode(school) {
  return structureData.value.find(x => x.text === school);
}

function getGradeNode(school, grade) {
  const schoolNode = getSchoolNode(school);
  const grades = Array.isArray(schoolNode?.children) ? schoolNode.children : [];
  return grades.find(x => x.text === grade);
}

function toOptions(arr = []) {
  return arr.map(x => ({label: x.text, value: x.text}));
}

const schoolOptions = computed(() => toOptions(structureData.value));
const fromGradeOptions = computed(() => {
  const schoolNode = getSchoolNode(copyForm.fromSchool);
  return toOptions(Array.isArray(schoolNode?.children) ? schoolNode.children : []);
});
const fromClassOptions = computed(() => {
  const gradeNode = getGradeNode(copyForm.fromSchool, copyForm.fromGrade);
  return toOptions(Array.isArray(gradeNode?.children) ? gradeNode.children : []);
});

const toGradeOptions = computed(() => {
  const schoolNode = getSchoolNode(copyForm.toSchool);
  return toOptions(Array.isArray(schoolNode?.children) ? schoolNode.children : []);
});
const toClassOptions = computed(() => {
  const gradeNode = getGradeNode(copyForm.toSchool, copyForm.toGrade);
  return toOptions(Array.isArray(gradeNode?.children) ? gradeNode.children : []);
});

watch(() => copyForm.fromSchool, () => {
  copyForm.fromGrade = '';
  copyForm.fromClass = '';
});
watch(() => copyForm.fromGrade, () => {
  copyForm.fromClass = '';
});
watch(() => copyForm.toSchool, () => {
  copyForm.toGrade = '';
  copyForm.toClass = '';
});
watch(() => copyForm.toGrade, () => {
  copyForm.toClass = '';
});

function validateCopyForm() {
  if (!copyForm.fromSchool || !copyForm.fromGrade || !copyForm.fromClass) {
    message.warning('请完整选择来源 学校/年级/班级');
    return false;
  }
  if (!copyForm.toSchool || !copyForm.toGrade || !copyForm.toClass) {
    message.warning('请完整选择目标 学校/年级/班级');
    return false;
  }
  if (
      copyForm.fromSchool === copyForm.toSchool &&
      copyForm.fromGrade === copyForm.toGrade &&
      copyForm.fromClass === copyForm.toClass
  ) {
    message.warning('来源与目标不能完全相同');
    return false;
  }
  return true;
}

function openCopyModal() {
  if (!validateCopyForm()) return;
  showCopyModal.value = true;
}

async function doCopyConfig() {
  if (!validateCopyForm()) return;
  copyLoading.value = true;
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
    );
    message.success('复制完成');
    showCopyModal.value = false;
    copyPwd.value = '';
  } catch (error) {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail || error?.response?.data?.error || '';
    if (status === 401) {
      message.error('你寻思寻思这密码它对吗？');
    } else if (status === 400 || status === 404) {
      message.error(detail || `复制失败（${status}）`);
    } else {
      message.error(`复制失败（${status || 'unknown'}）`);
    }
  } finally {
    copyLoading.value = false;
  }
}
</script>

<template>
    <NFlex vertical>
        <NCard title="今日统计">
            <NFlex justify="center">
                <NCard class="stat">
                  <NStatistic label="天气上游 API 响应错误" :value="weatherError"/>
                </NCard>
                <NCard class="stat">
                  <NStatistic label="WebSocket 异常断连" :value="wsDisconnect"/>
                </NCard>
                <NCard class="stat">
                 <NStatistic label="正在连接的客户端数量" :value="clientsCount"/>
                </NCard>
            </NFlex>
        </NCard>
      <NCard title="配置复制（复制自...）">
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
                  <NSelect v-model:value="copyForm.toSchool" :options="schoolOptions" placeholder="选择目标学校"/>
                </NFormItem>
                <NFormItem label="年级">
                  <NSelect v-model:value="copyForm.toGrade" :options="toGradeOptions" placeholder="选择目标年级"/>
                </NFormItem>
                <NFormItem label="班级">
                  <NSelect v-model:value="copyForm.toClass" :options="toClassOptions" placeholder="选择目标班级"/>
                </NFormItem>
              </NForm>
            </NCard>
          </NFlex>
          <NFlex justify="center">
            <NButton type="primary" @click="openCopyModal">复制配置</NButton>
          </NFlex>
            </NFlex>
        </NCard>
        <NCard title="各班详情">
            <n-data-table
              ref="dataTableInst"
              :columns="columns"
              :data="statTable"
            />
        </NCard>

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
