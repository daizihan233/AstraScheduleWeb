<template>
  <!-- 🤔 -->
  <n-config-provider :theme="theme" date-locale="dateZhCN" locale="zhCN" class="full" :hljs="hljs">
    <n-message-provider class="full">
      <n-dialog-provider class="full">
        <n-space vertical class="full">
          <n-layout has-sider style="height: 100vh">
            <n-layout-sider
              bordered
              collapse-mode="width"
              :collapsed-width="64"
              :width="240"
              :collapsed="collapsed"
              show-trigger
              @collapse="collapsed = true"
              @expand="collapsed = false"
            >
              <n-menu
                v-model:value="activeKey"
                :collapsed="collapsed"
                :collapsed-width="64"
                :collapsed-icon-size="22"
                :options="menuOptions"
              />
            </n-layout-sider>
            <n-layout style="padding: 16px">
              <n-alert
                  v-if="showInitServerEntry"
                  style="margin-bottom: 12px"
                  title="检测到服务端尚未配置学校/年级/班级"
                  type="warning"
              >
                当前 menu 中没有可用的学校班级配置，请先初始化服务端。
                <template #action>
                  <n-button size="small" type="primary" @click="openInitModal">
                    初始化服务器
                  </n-button>
                </template>
              </n-alert>
              <router-view></router-view>
            </n-layout>
          </n-layout>
        </n-space>
      </n-dialog-provider>
    </n-message-provider>

    <n-modal v-model:show="showInitModal" preset="dialog" title="初始化服务器">
      <n-form label-placement="top">
        <n-form-item label="学校">
          <n-input v-model:value="initForm.school" placeholder="例如：实验中学"/>
        </n-form-item>
        <n-form-item label="年级">
          <n-input v-model:value="initForm.grade" placeholder="例如：高一"/>
        </n-form-item>
        <n-form-item label="班级">
          <n-input v-model:value="initForm.cls" placeholder="例如：1班"/>
        </n-form-item>
        <n-form-item label="管理员密码">
          <n-input v-model:value="initForm.password" placeholder="用于 Basic Auth" show-password-on="click"
                   type="password"/>
        </n-form-item>
        <n-form-item label="初始化请求体（JSON，可按需修改）">
          <n-input
              v-model:value="initForm.bodyText"
              :autosize="{ minRows: 12, maxRows: 20 }"
              placeholder="参考 InitSrv.http 的 JSON"
              type="textarea"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button :loading="initLoading" type="primary" @click="submitInitServer">
          提交初始化
        </n-button>
      </template>
    </n-modal>
  </n-config-provider>

</template>

<script setup>
import {computed, h, reactive, ref} from "vue";
import {
  darkTheme,
  NAlert,
  NButton,
  NConfigProvider,
  NDialogProvider,
  NForm,
  NFormItem,
  NInput,
  NLayout,
  NLayoutSider,
  NMenu,
  NMessageProvider,
  NModal,
  NSpace,
  useMessage,
  useOsTheme
} from "naive-ui";
import {RouterLink} from "vue-router";
import {useRequest} from "vue-request";
import axios from "axios";
import {APISRV} from "@/global.js";
import hljs from 'highlight.js/lib/core'

const osThemeRef = useOsTheme();
let theme = computed(() => osThemeRef.value === "dark" ? darkTheme : null);
const message = useMessage();

function pad(n) {
  return n.toString().padStart(2, '0');
}

function ymd(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildDefaultInitBody() {
  return {
    subject_name: {
      "自": "自习",
      "英": "英语",
      "语": "语文",
      "体": "体育",
      "数": "数学",
      "史": "历史",
      "政": "政治",
      "班": "班会",
      "物": "物理",
      "化": "化学",
      "课": "课程"
    },
    timetable: {
      "常日": {
        "00:00-00:00": 0,
        "00:01-23:59": "尽量不要在部署阶段修改，最好通过 Web 端来修改"
      },
      "没课": {
        "00:00-00:00": 0,
        "00:01-23:59": "没课 q(≧▽≦q)"
      }
    },
    divider: {
      "常日": [],
      "没课": []
    },
    start: ymd(Date.now()),
    countdown_target: "hidden",
    weather_alert_override: true,
    weather_alert_brief: true,
    week_display: true,
    banner_text: "",
    css_style: {
      "--center-font-size": "30px",
      "--corner-font-size": "14px",
      "--countdown-font-size": "28px",
      "--global-border-radius": "16px",
      "--global-bg-opacity": "0.3",
      "--container-bg-padding": "8px 14px",
      "--countdown-bg-padding": "5px 12px",
      "--container-space": "16px",
      "--top-space": "16px",
      "--main-horizontal-space": "8px",
      "--divider-width": "2px",
      "--divider-margin": "6px",
      "--triangle-size": "16px",
      "--sub-font-size": "20px",
      "--banner-height": "30px"
    },
    daily_class: [
      {
        "Chinese": "日",
        "English": "SUN",
        "classList": ["课"],
        "timetable": "没课"
      },
      {
        "Chinese": "一",
        "English": "MON",
        "classList": ["课"],
        "timetable": "常日"
      },
      {
        "Chinese": "二",
        "English": "TUE",
        "classList": ["课"],
        "timetable": "常日"
      },
      {
        "Chinese": "三",
        "English": "WED",
        "classList": ["课"],
        "timetable": "常日"
      },
      {
        "Chinese": "四",
        "English": "THR",
        "classList": ["课"],
        "timetable": "常日"
      },
      {
        "Chinese": "五",
        "English": "FRI",
        "classList": ["课"],
        "timetable": "常日"
      },
      {
        "Chinese": "六",
        "English": "SAT",
        "classList": ["课"],
        "timetable": "没课"
      }
    ]
  };
}

const showInitServerEntry = ref(false);
const showInitModal = ref(false);
const initLoading = ref(false);
const initForm = reactive({
  school: '',
  grade: '',
  cls: '',
  password: '',
  bodyText: JSON.stringify(buildDefaultInitBody(), null, 2)
});

function hasSchoolGradeClassMenu(rawList) {
  const queue = Array.isArray(rawList) ? [...rawList] : [];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== 'object') continue;
    if (typeof node.to === 'string' && /^\/config\/[^/]+\/[^/]+\/[^/]+\//.test(node.to)) {
      return true;
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      queue.push(...node.children);
    }
  }
  return false;
}
// noinspection JSUnusedGlobalSymbols
let menuOptions = ref(
    [
        {
            label: () => h(
              RouterLink,
              {
                to: {
                  name: "Home"
                }
              },
              { default: () => "总览" }
            ),
            key: "go-back-home"
        }
    ]
);

// 直接请求，无需 setTimeout 包装，避免 Promise 嵌套潜在问题
const getMenu = () => axios.get(`${APISRV}/web/menu`);

function resolveMenuItem(menuItem) {
    if (!menuItem) return null;
    // 递归处理数组
    if (Array.isArray(menuItem)) return menuItem.map(resolveMenuItem).filter(Boolean);
    const childrenSrc = menuItem.children;
    const resolvedChildren = Array.isArray(childrenSrc) && childrenSrc.length > 0 ? resolveMenuItem(childrenSrc) : undefined;
    if (typeof menuItem['to'] !== 'string') {
        console.warn('[menu] 菜单项缺少 to 字段，忽略', menuItem);
        return {
          key: menuItem['key'],
          children: resolvedChildren,
          label: menuItem['text']
        };
    }
    return {
        label: () => h(
            RouterLink,
            { to: menuItem['to'] },
            { default: () => menuItem['text'] }
        ),
        key: menuItem['key'],
        children: resolvedChildren
    };
}

function updateMenuFromResponse(response) {
  try {
    const payload = response?.data;
    const rawList = payload?.data;
    if (!Array.isArray(rawList)) {
      console.warn('[menu] 响应 data.data 不是数组，保持原菜单');
      return;
    }
    showInitServerEntry.value = !hasSchoolGradeClassMenu(rawList);
    const menu = rawList.map(d => resolveMenuItem(d)).filter(Boolean);
    if (menu.length === 0) {
      console.warn('[menu] 解析后为空，保留原菜单');
      return;
    }
    menuOptions.value = menu;
  } catch (e) {
    console.error('[menu] 解析失败', e);
  }
}

function openInitModal() {
  initForm.bodyText = JSON.stringify(buildDefaultInitBody(), null, 2);
  showInitModal.value = true;
}

async function submitInitServer() {
  if (!initForm.school || !initForm.grade || !initForm.cls) {
    message.warning('请完整填写学校/年级/班级');
    return;
  }
  if (!initForm.password) {
    message.warning('请输入管理员密码');
    return;
  }
  let payload;
  try {
    payload = JSON.parse(initForm.bodyText);
  } catch (e) {
    message.error('初始化请求体不是合法 JSON');
    return;
  }

  initLoading.value = true;
  try {
    const encodedSchool = encodeURIComponent(initForm.school);
    const encodedGrade = encodeURIComponent(initForm.grade);
    const encodedCls = encodeURIComponent(initForm.cls);
    await axios.put(
        `${APISRV}/${encodedSchool}/${encodedGrade}/${encodedCls}`,
        payload,
        {
          auth: {
            username: 'AstraSchedule',
            password: initForm.password
          }
        }
    );
    message.success('初始化成功，正在刷新菜单');
    showInitModal.value = false;
    initForm.password = '';

    const response = await getMenu();
    updateMenuFromResponse(response);
  } catch (error) {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail || error?.response?.data?.error || '';
    if (status === 401) {
      message.error('鉴权失败：管理员密码不正确');
    } else if (status === 400 || status === 404) {
      message.error(detail || `初始化失败（${status}）`);
    } else {
      message.error(`初始化失败（${status || 'unknown'}）`);
    }
  } finally {
    initLoading.value = false;
  }
}

useRequest(
    getMenu,
    {
      initialData: {
        data: [
          {
            to: '/',
            text: '总览',
            key: 'go-back-home',
            children: []
          }
        ]
      },
      onSuccess: (response) => {
        updateMenuFromResponse(response);
      },
      onError: (e) => {
        console.error('[menu] 获取失败', e);
      }
    }
);

let activeKey =  ref(null), collapsed = ref(false)
</script>
