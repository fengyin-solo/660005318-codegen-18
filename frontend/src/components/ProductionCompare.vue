<template>
  <div class="compare-panel">
    <div class="head-row">
      <h4>📊 产量批量对比</h4>
      <button class="btn primary" :disabled="running || store.compareGroups.length === 0" @click="runCompare">
        {{ running ? '计算中…' : '开始对比' }}
      </button>
    </div>

    <!-- 对比组编辑：多时间范围 / 多设备组合 -->
    <div class="group-list">
      <div v-for="(g, i) in store.compareGroups" :key="i" class="group-row">
        <label class="base-radio" title="设为基准组">
          <input type="radio" name="baseline" :checked="store.compareBaseline === i" @change="store.compareBaseline = i" />
        </label>
        <input v-model="g.name" class="name-input" :placeholder="'组' + (i + 1)" />
        <input type="datetime-local" class="time-input" :value="toLocalInput(g.start)" @change="g.start = fromLocalInput(($event.target as HTMLInputElement).value)" />
        <span class="sep">→</span>
        <input type="datetime-local" class="time-input" :value="toLocalInput(g.end)" @change="g.end = fromLocalInput(($event.target as HTMLInputElement).value)" />
        <el-select v-model="g.device_ids" multiple collapse-tags collapse-tags-tooltip placeholder="全部设备" size="small" class="dev-select">
          <el-option v-for="d in deviceOptions" :key="d.id" :label="d.type + ' #' + d.id" :value="d.id" />
        </el-select>
        <button class="btn del" title="删除该组" @click="removeGroup(i)">✕</button>
      </div>
    </div>
    <div class="toolbar">
      <button class="btn" @click="addGroup">＋ 添加对比组</button>
      <span class="hint">基准组: {{ baselineName }}（左侧单选可切换）</span>
    </div>

    <!-- 统计指标切换 -->
    <div v-if="result" class="metric-tabs">
      <button v-for="m in COMPARE_METRICS" :key="m.key" class="btn tab" :class="{ active: store.compareMetric === m.key }"
              @click="store.compareMetric = m.key">{{ m.label }}</button>
    </div>

    <!-- 跳过的组：指出原因，不影响其余组 -->
    <div v-if="result && result.skipped.length" class="skipped-box">
      <div class="skipped-title">⚠️ 已跳过 {{ result.skipped.length }} 组（其余组正常计算）</div>
      <div v-for="(s, i) in result.skipped" :key="i" class="skipped-item">「{{ s.name }}」{{ s.reason }}</div>
    </div>

    <div v-if="errorMsg" class="skipped-box"><div class="skipped-title">⚠️ {{ errorMsg }}</div></div>

    <!-- 结果：图表 + 明细表 -->
    <template v-if="result && result.results.length">
      <div ref="chart" class="chart"></div>
      <table class="result-table">
        <thead>
          <tr><th>组</th><th>产量</th><th>故障</th><th>设备数</th><th>采样点</th><th>实际范围</th><th>与基准差异</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in result.results" :key="r.index" :class="{ baseline: r.name === result.baseline }">
            <td>{{ r.name }}<span v-if="r.name === result.baseline" class="base-tag">基准</span></td>
            <td>{{ r.production }}</td>
            <td>{{ r.faults }}</td>
            <td>{{ r.device_count }}</td>
            <td>{{ r.sample_count }}</td>
            <td class="range">{{ fmtTime(r.actual_start) }} ~ {{ fmtTime(r.actual_end) }}</td>
            <td>
              <template v-if="r.name === result.baseline">—</template>
              <template v-else>
                <span :class="diffClass(r.production_diff)">产量 {{ fmtDiff(r.production_diff) }}<template v-if="r.production_diff_pct !== null"> ({{ fmtDiff(r.production_diff_pct) }}%)</template></span>
                <span :class="diffClass(-r.fault_diff)" class="fault-diff">故障 {{ fmtDiff(r.fault_diff) }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
    <div v-else-if="result" class="empty">没有可展示的对比结果</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useFactoryStore } from '../store/factory'
import { COMPARE_METRICS } from '../types'
import type { CompareResponse } from '../types'

const store = useFactoryStore()
const running = ref(false)
const errorMsg = ref('')
const chart = ref<HTMLDivElement>()
let inst: echarts.ECharts | null = null

const result = computed(() => store.compareResult)
const deviceOptions = computed(() => store.data?.devices || [])
const baselineName = computed(() => {
  const g = store.compareGroups[store.compareBaseline]
  return g ? (g.name.trim() || `组${store.compareBaseline + 1}`) : '—'
})

function toLocalInput(ts: number) {
  const d = new Date(ts * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function fromLocalInput(s: string) {
  const t = new Date(s).getTime()
  return isNaN(t) ? 0 : t / 1000
}
function fmtTime(ts: number) { return new Date(ts * 1000).toLocaleTimeString() }
function fmtDiff(n: number) { return (n > 0 ? '+' : '') + n }
function diffClass(n: number) { return n > 0 ? 'diff-up' : n < 0 ? 'diff-down' : 'diff-flat' }

function addGroup() {
  const now = Date.now() / 1000
  store.compareGroups.push({ name: '', start: now - 300, end: now, device_ids: [] })
}
function removeGroup(i: number) {
  store.compareGroups.splice(i, 1)
  if (store.compareBaseline >= store.compareGroups.length) store.compareBaseline = 0
}

async function runCompare() {
  running.value = true
  errorMsg.value = ''
  try {
    const resp = await fetch(`http://${location.hostname}:8000/api/production/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups: store.compareGroups, baseline: store.compareBaseline }),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    store.compareResult = await resp.json() as CompareResponse
  } catch (e: any) {
    errorMsg.value = `对比请求失败: ${e?.message || e}`
  } finally {
    running.value = false
  }
}

function updateChart() {
  if (!inst || !result.value) return
  const metric = store.compareMetric
  const label = COMPARE_METRICS.find(m => m.key === metric)?.label || metric
  const rs = result.value.results
  inst.setOption({
    backgroundColor: 'transparent',
    grid: { left: 45, right: 15, top: 25, bottom: 25 },
    title: { text: label, textStyle: { color: '#94a3b8', fontSize: 11 }, left: 5, top: 2 },
    xAxis: { type: 'category', data: rs.map(r => r.name), axisLabel: { color: '#94a3b8', fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
    series: [{
      type: 'bar', name: label,
      data: rs.map(r => ({
        value: r[metric],
        itemStyle: { color: r.name === result.value!.baseline ? '#fbbf24' : '#3b82f6' },
      })),
      label: { show: true, position: 'top', color: '#e0e6ed', fontSize: 10 },
    }],
    animation: false,
  })
}

onMounted(() => { if (chart.value) inst = echarts.init(chart.value) })
watch([result, () => store.compareMetric], async () => {
  await nextTick()
  if (!inst && chart.value) inst = echarts.init(chart.value)
  updateChart()
})
onUnmounted(() => inst?.dispose())
</script>

<style scoped>
.compare-panel{background:#0d1b2a;border-radius:8px;padding:12px;border:1px solid #1e3a5f}
.head-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.head-row h4{color:#64b5f6;font-size:13px}
.group-list{display:flex;flex-direction:column;gap:6px}
.group-row{display:flex;align-items:center;gap:6px;background:#112233;border-radius:4px;padding:6px 8px}
.base-radio{display:flex;align-items:center}
.base-radio input{accent-color:#fbbf24}
.name-input{width:90px;background:#0d1b2a;border:1px solid #1e3a5f;border-radius:4px;color:#e0e6ed;padding:4px 6px;font-size:12px}
.time-input{background:#0d1b2a;border:1px solid #1e3a5f;border-radius:4px;color:#e0e6ed;padding:3px 4px;font-size:11px;color-scheme:dark}
.sep{color:#64748b}
.dev-select{flex:1;min-width:120px}
.btn{background:#1e3a5f;border:1px solid #2d5a8a;color:#e0e6ed;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer}
.btn:hover{background:#2d5a8a}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.primary{background:#2563eb;border-color:#3b82f6}
.btn.primary:hover{background:#3b82f6}
.btn.del{padding:4px 8px;color:#f87171}
.toolbar{display:flex;align-items:center;gap:12px;margin-top:8px}
.hint{font-size:11px;color:#64748b}
.metric-tabs{display:flex;gap:6px;margin-top:10px}
.btn.tab.active{background:#2563eb;border-color:#3b82f6}
.skipped-box{margin-top:10px;background:#2a2110;border:1px solid #a16207;border-radius:6px;padding:8px 10px}
.skipped-title{color:#fbbf24;font-size:12px;font-weight:600;margin-bottom:4px}
.skipped-item{color:#d4b483;font-size:11px;line-height:1.6}
.chart{width:100%;height:180px;margin-top:8px}
.result-table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
.result-table th{color:#64b5f6;text-align:left;padding:5px 6px;border-bottom:1px solid #1e3a5f;font-weight:600}
.result-table td{color:#cbd5e1;padding:5px 6px;border-bottom:1px solid #14273d}
.result-table tr.baseline td{background:#1a2a1a}
.base-tag{margin-left:6px;font-size:10px;color:#fbbf24;border:1px solid #fbbf24;border-radius:3px;padding:0 4px}
.range{color:#94a3b8}
.diff-up{color:#4ade80}
.diff-down{color:#f87171}
.diff-flat{color:#94a3b8}
.fault-diff{margin-left:10px}
.empty{margin-top:10px;color:#64748b;font-size:12px}
</style>
