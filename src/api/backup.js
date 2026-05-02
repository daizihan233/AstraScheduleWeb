import axios from 'axios'
import { APISRV } from '@/global.js'

export async function exportBackup(password) {
  return axios.get(`${APISRV}/web/backup/export`, {
    responseType: 'blob',
    auth: {
      username: 'ElectronClassSchedule',
      password
    }
  })
}

export async function importBackup(file, password) {
  const formData = new FormData()
  formData.append('file', file)
  return axios.post(`${APISRV}/web/backup/import`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    auth: {
      username: 'ElectronClassSchedule',
      password
    }
  })
}

// 完整备份导出（使用 POST 方法）
export async function fullExport(password) {
  return axios.post(`${APISRV}/web/backup/full-export`, {}, {
    responseType: 'blob',
    auth: {
      username: 'ElectronClassSchedule',
      password
    }
  })
}

// 完整备份导入（支持 overwrite/skip 模式）
export async function fullImport(file, password, mode = 'overwrite') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('password', password)
  formData.append('mode', mode)
  return axios.post(`${APISRV}/web/backup/full-import`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    auth: {
      username: 'ElectronClassSchedule',
      password
    }
  })
}