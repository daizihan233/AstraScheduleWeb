<script setup>
import {NButton, NCard, NCode, NFlex, NForm, NFormItem, NInput, NSpace, NStatistic, useMessage} from "naive-ui";
import {computed, reactive, ref} from "vue";
import {zip} from "@/utils.js";
import axios from "axios";
import {APISRV} from "@/global.js";
import {useRequest} from "vue-request";
import {useRoute} from "vue-router";
import ConfirmPasswordModal from '@/components/ConfirmPasswordModal.vue';

const route = useRoute();

const school = computed(() => route.params.school);
const grade = computed(() => route.params.grade);
const formRef = ref(null);

const dynamicForm = reactive({
  abbr: [{ text: "" }],
  fullName: [{ text: "" }]
});

const removeItem = (index) => {
  dynamicForm.abbr.splice(index, 1);
  dynamicForm.fullName.splice(index, 1);
};

const addItem = () => {
  dynamicForm.abbr.push({ text: "" });
  dynamicForm.fullName.push({ text: "" });
};

let showModal = ref(false);
let pwdModalLoading = ref(false);

function submit() {
    showModal.value = true;
}

const putSubjects = (password) => {
    return Promise.resolve(
        axios.put(
            `${APISRV}/web/config/${school.value}/${grade.value}/subjects`,
            dynamicForm,
            {
                auth: {
                    username: 'ElectronClassSchedule',
                    password: password
                }
            }
        )
    );
}

const messages = useMessage();
function onPwdConfirm(password) {
    pwdModalLoading.value = true
    useRequest(
        () => putSubjects(password),
        {
            onSuccess: (response) => {
                console.log(response.data)
                console.log(response.status)
                messages.success("服务端说行")
                showModal.value = false
            },
            onError: (error) => {
                console.log(error)
                if (error.status === 401) {
                    messages.error("你寻思寻思这密码它对吗？")
                } else if (error.status === 400) {
                    messages.error("码姿不对，删了重写！（服务端校验不通过）")
                } else {
                    messages.error(`服务端看完天塌了（状态码：${error}）`)
                }
            },
            onFinally: () => {
                pwdModalLoading.value = false
            }
        }
    );
}

const getSubjects = () => {
  return Promise.resolve(axios.get(`${APISRV}/web/config/${school.value}/${grade.value}/subjects`));
}

useRequest(
    getSubjects,
    {
      refreshDeps: [school, grade],
      initialData: {
          "abbr": [],
          "fullName": []
      },
      onSuccess: (response) => {
          console.log(response.data);
          dynamicForm.abbr = response.data['abbr'];
          dynamicForm.fullName = response.data['fullName'];
      }
    }
);

const previewCode = computed(() => JSON.stringify(dynamicForm, null, 2));
</script>

<template>
    <NFlex vertical>
        <NCard title="所选信息">
            <NFlex justify="center">
                <NCard class="stat">
                  <NStatistic label="所选学校" v-bind:value="school.toString()"/>
                </NCard>
                <NCard class="stat">
                  <NStatistic label="所选年级" v-bind:value="grade.toString()"/>
                </NCard>
            </NFlex>
        </NCard>
        <NCard title="配置表单">
            <n-form ref="formRef" :model="dynamicForm" class="center" :show-label="false">
                <n-form-item class="center" v-for="(item, index) in zip(dynamicForm.abbr, dynamicForm.fullName)">
                    <n-flex justify="center" size="large" class="center">
                        <n-form-item
                          :key="index"
                          :label="`课程 ${index + 1} 缩写`"
                          :path="`abbr[${index}].text`"
                          :rule="{
                            required: true,
                            message: `课程 ${index + 1} 缩写`,
                            trigger: ['input', 'blur'],
                          }"
                        >
                          <n-input v-model:value="item[0].text" clearable />
                        </n-form-item>
                        <n-form-item
                          :key="index"
                          :label="`课程 ${index + 1} 全写`"
                          :path="`fullName[${index}].text`"
                          :rule="{
                            required: true,
                            message: `课程 ${index + 1} 全写`,
                            trigger: ['input', 'blur'],
                          }"
                        >
                          <n-input v-model:value="item[1].text" clearable />
                          <n-button style="margin-left: 12px" @click="removeItem(index)">
                            删除
                          </n-button>
                        </n-form-item>
                    </n-flex>
                </n-form-item>
                <n-form-item class="center">
                  <n-flex justify="center" size="large" class="center">
                    <n-button attr-type="button" @click="submit">
                      提交
                    </n-button>
                    <n-button attr-type="button" @click="addItem">
                      增加
                    </n-button>
                  </n-flex>
                </n-form-item>
            </n-form>
        </NCard>
        <NCard title="提交前预览">
          <n-code :code="previewCode" language="json" show-line-numbers/>
        </NCard>

        <ConfirmPasswordModal
            v-model:show="showModal"
            :loading="pwdModalLoading"
            confirm-text="确认提交"
            @confirm="onPwdConfirm"
        />
    </NFlex>
</template>
