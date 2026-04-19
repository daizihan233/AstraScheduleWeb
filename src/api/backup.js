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