// 通用作用域工具
import {parseScope} from '@/api/autorun.js'

function collectScopeLevels(arr) {
  const schoolSet = new Set()
  const gradeSet = new Set()
  for (const v of arr) {
    const p = parseScope(v)
    if (p.level === 'school') schoolSet.add(p.school)
    else if (p.level === 'grade') gradeSet.add(`${p.school}/${p.grade}`)
  }
  return {schoolSet, gradeSet}
}

function shouldIncludeScope(p, schoolSet, gradeSet) {
  if (p.level === 'school') return true
  if (p.level === 'grade') return !schoolSet.has(p.school)
  return !schoolSet.has(p.school) && !gradeSet.has(`${p.school}/${p.grade}`)
}

export function normalizeScopes(list) {
  const arr = Array.isArray(list) ? Array.from(new Set(list)) : []
  const {schoolSet, gradeSet} = collectScopeLevels(arr)
  return arr.filter(v => {
    const p = parseScope(v)
    return shouldIncludeScope(p, schoolSet, gradeSet)
  })
}
  const out = []
  for (const v of arr) {
    const p = parseScope(v)
    if (p.level === 'school') out.push(v)
    else if (p.level === 'grade') {
      if (!schoolSet.has(p.school)) out.push(v)
    } else if (p.level === 'class') {
      if (!schoolSet.has(p.school) && !gradeSet.has(`${p.school}/${p.grade}`)) out.push(v)
    }
  }
  return out
}

function isDisabledForLevel(p, schoolSet, gradeSet) {
  if (p.level === 'grade') return schoolSet.has(p.school)
  if (p.level === 'class') return schoolSet.has(p.school) || gradeSet.has(`${p.school}/${p.grade}`)
  return false
}

export function applyDisabledToScopeOptions(options, selected) {
  const arr = Array.isArray(options) ? options : []
  const sel = Array.isArray(selected) ? selected : []
  const {schoolSet, gradeSet} = collectScopeLevels(sel)
  return arr.map(opt => {
    const p = parseScope(opt.value)
    return {...opt, disabled: isDisabledForLevel(p, schoolSet, gradeSet)}
  })
}

export function parseGradePairsFromScopes(scopes) {
  const pairs = []
  const seen = new Set()
  for (const v of scopes || []) {
    const p = parseScope(v)
    if (p.level === 'grade' || p.level === 'class') {
      const key = `${p.school}/${p.grade}`
      if (!seen.has(key) && p.school && p.grade) {
        pairs.push({school: p.school, grade: p.grade});
        seen.add(key)
      }
    }
  }
  return pairs
}

// 在一棵 { value, children } 树中查找节点
export function findNodeByValue(nodes, value) {
  const stack = Array.isArray(nodes) ? [...nodes] : []
  while (stack.length) {
    const n = stack.shift()
    if (n?.value === value) return n
    if (Array.isArray(n?.children)) stack.push(...n.children)
  }
  return null
}

