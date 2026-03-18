import axios from 'axios'
import {APISRV} from '@/global.js'
import {fetchScopeTree, flattenScope} from '@/api/autorun.js'

export {fetchScopeTree, flattenScope}

export async function listCountdown(scope) {
  const url = scope
    ? `${APISRV}/web/countdown?scope=${encodeURIComponent(scope)}`
    : `${APISRV}/web/countdown`
  const resp = await axios.get(url)
  const arr = Array.isArray(resp?.data?.data) ? resp.data.data : []
  return {
    data: arr.map(it => ({
      id: it.id,
      scope: Array.isArray(it.scope) ? it.scope : [],
      schedules: Array.isArray(it.schedules) ? it.schedules : []
    }))
  }
}

export async function getCountdown(id) {
  const resp = await axios.get(`${APISRV}/web/countdown/${id}`)
  const d = resp?.data?.data
  if (!d || Array.isArray(d)) return {data: null}
  return {
    data: {
      id: d.id,
      scope: Array.isArray(d.scope) ? d.scope : [],
      schedules: Array.isArray(d.schedules) ? d.schedules : []
    }
  }
}

export async function saveCountdown(payload, password) {
  return axios.put(`${APISRV}/web/countdown`, payload, {
    auth: {
      username: 'ElectronClassSchedule',
      password
    }
  })
}

export async function deleteCountdown(id, password) {
  return axios.delete(`${APISRV}/web/countdown/${id}`, {
    auth: {
      username: 'ElectronClassSchedule',
      password
    }
  })
}
