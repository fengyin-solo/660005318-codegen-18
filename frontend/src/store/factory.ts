import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { FactoryData, CompareGroupDef, CompareMetric, CompareResponse } from '@/types'

function defaultGroups(): CompareGroupDef[] {
  const now = Date.now() / 1000
  return [
    { name: '前5分钟', start: now - 600, end: now - 300, device_ids: [] },
    { name: '近5分钟', start: now - 300, end: now, device_ids: [] },
  ]
}

function loadPersisted<T>(key: string, fallback: () => T): T {
  try {
    const s = localStorage.getItem(key)
    return s ? JSON.parse(s) : fallback()
  } catch { return fallback() }
}

export const useFactoryStore = defineStore('factory', () => {
  const data = ref<FactoryData | null>(null)
  const ws = ref<WebSocket | null>(null)
  const connected = ref(false)

  function connect() {
    if (ws.value) return
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const s = new WebSocket(`${protocol}//${location.hostname}:8000/ws`)
    s.onopen = () => { connected.value = true; console.log('WS connected') }
    s.onmessage = (e) => {
      try { data.value = JSON.parse(e.data) } catch {}
    }
    s.onclose = () => { connected.value = false; ws.value = null }
    ws.value = s
  }

  function disconnect() {
    ws.value?.close()
    ws.value = null
    connected.value = false
  }

  // ---- 产量批量对比：选择持久化，返回页面后保留上一次的选择 ----
  const compareGroups = ref<CompareGroupDef[]>(loadPersisted('compareGroups', defaultGroups))
  const compareMetric = ref<CompareMetric>(loadPersisted('compareMetric', () => 'production'))
  const compareBaseline = ref<number>(loadPersisted('compareBaseline', () => 0))
  const compareResult = ref<CompareResponse | null>(null)

  watch(compareGroups, (v) => localStorage.setItem('compareGroups', JSON.stringify(v)), { deep: true })
  watch(compareMetric, (v) => localStorage.setItem('compareMetric', JSON.stringify(v)))
  watch(compareBaseline, (v) => localStorage.setItem('compareBaseline', JSON.stringify(v)))

  return {
    data, connected, connect, disconnect,
    compareGroups, compareMetric, compareBaseline, compareResult,
  }
})
