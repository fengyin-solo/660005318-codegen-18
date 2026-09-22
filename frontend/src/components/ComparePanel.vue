<template>
  <div class="compare-panel">
    <div class="panel-head">
      <h4>📊 产量批量对比</h4>
      <el-radio-group v-if="store.view === 'setup'" v-model="store.mode" size="small">
        <el-radio-button value="single">单次查看</el-radio-button>
        <el-radio-button value="batch">批量对比</el-radio-button>
      </el-radio-group>
      <el-button v-if="store.view === 'result'" size="small" @click="store.backToSetup()">
        ← 返回设置
      </el-button>
    </div>

    <!-- ============ 设置视图 ============ -->
    <div v-if="store.view === 'setup'" class="setup">
      <!-- 单次查看 -->
      <template v-if="store.mode === 'single'">
        <CompareGroupEditor
          :draft="store.single"
          :index="0"
          :devices="devices"
          :device-types="deviceTypes"
        />
        <div class="actions">
          <el-button type="primary" size="small" :loading="store.loading" @click="onRunSingle">
            查询
          </el-button>
          <span class="hint">选择一个时间范围与设备组合，查看产量、故障次数与统计口径。</span>
        </div>
      </template>

      <!-- 批量对比 -->
      <template v-else>
        <div v-for="(g, i) in store.batch" :key="i" class="batch-group">
          <div class="group-title">
            <el-radio
              :model-value="store.baselineIndex"
              :value="i"
              @change="store.baselineIndex = i"
            >
              <span :class="{ 'is-base': store.baselineIndex === i }">基准</span>
            </el-radio>
            <span class="g-index">组{{ i + 1 }}</span>
          </div>
          <CompareGroupEditor
            :draft="g"
            :index="i"
            :devices="devices"
            :device-types="deviceTypes"
            :removable="store.batch.length > 1"
            @remove="store.removeGroup(i)"
          />
        </div>
        <div class="actions">
          <el-button size="small" :disabled="store.batch.length >= 10" @click="store.addGroup">
            ＋ 添加对比组
          </el-button>
          <el-button type="primary" size="small" :loading="store.loading" @click="onRunBatch">
            开始批量对比（{{ store.batch.length }} 组）
          </el-button>
          <span class="hint">最多 10 组；范围无采样数据或互相重叠的组将被指出并跳过，不影响其余组。</span>
        </div>
      </template>
      <div v-if="store.error" class="error-msg">{{ store.error }}</div>
    </div>

    <!-- ============ 结果视图 ============ -->
    <div v-else class="result">
      <template v-if="resp">
        <!-- 全局提示 -->
        <el-alert
          v-if="resp.baseline_fallback"
          type="warning"
          :closable="false"
          show-icon
          class="alert"
          :title="`指定的基准组（组${resp.baseline_requested + 1}）无效，已自动以组${resp.baseline_index + 1}为基准。`"
        />

        <!-- 跳过组清单 -->
        <div v-if="skippedGroups.length" class="skip-box">
          <div class="skip-title">以下组已跳过（不影响其余组的对比结果）：</div>
          <div v-for="g in skippedGroups" :key="g.index" class="skip-item">
            <el-tag type="info" size="small">{{ g.name }}</el-tag>
            <span class="skip-reason">{{ g.skip_reason }}</span>
            <span v-if="g.overlap_with.length" class="skip-detail">
              冲突组：<el-tag v-for="n in g.overlap_with" :key="n" size="small" type="warning">{{ n }}</el-tag>
            </span>
            <span v-if="g.unknown_device_ids.length" class="skip-detail">
              未识别设备ID：{{ g.unknown_device_ids.join(', ') }}
            </span>
          </div>
        </div>

        <!-- 截断提示 -->
        <div v-if="truncatedGroups.length" class="warn-box">
          <span v-for="g in truncatedGroups" :key="g.index" class="warn-item">
            ⚠ {{ g.name }} 的结束时间晚于当前时间，统计窗口已截断至 {{ fmtTime(g.truncated_to!) }}
          </span>
        </div>

        <div v-if="!validGroups.length" class="empty">没有可用于对比的有效组，请返回调整后重试。</div>

        <template v-else>
          <!-- 单次查看：卡片展示 -->
          <div v-if="store.mode === 'single' && firstValid" class="single-card">
            <div class="metric-grid">
              <div v-for="key in METRIC_KEYS" :key="key" class="metric-cell">
                <div class="m-label">{{ METRIC_META[key].label }}</div>
                <div class="m-value">{{ formatMetric(firstValid, key) }}</div>
                <div class="m-unit">{{ METRIC_META[key].unit }}</div>
              </div>
            </div>
            <div class="caliber">
              <template v-if="firstValid.metrics">
                <span class="cal-title">统计口径：</span>
                <span>{{ firstValid.metrics.caliber.window }}</span>
                <el-divider direction="vertical" />
                <span>采样点 {{ firstValid.metrics.caliber.sample_points }}</span>
                <el-divider direction="vertical" />
                <span>样本数 {{ firstValid.metrics.caliber.total_samples }}</span>
                <el-divider direction="vertical" />
                <span>设备 {{ firstValid.metrics.caliber.device_count }} 台</span>
                <el-divider direction="vertical" />
                <span>跨度 {{ firstValid.metrics.caliber.span_minutes.toFixed(1) }} 分钟</span>
                <el-divider direction="vertical" />
                <span>{{ fmtTime(firstValid.start) }} ~ {{ fmtTime(firstValid.end) }}</span>
                <el-divider direction="vertical" />
                <span>设备ID: {{ firstValid.device_ids.join(', ') || '全部' }}</span>
              </template>
            </div>
          </div>

          <!-- 批量对比：并排结果表 -->
          <template v-else>
            <div class="table-wrap">
              <table class="cmp-table">
                <thead>
                  <tr>
                    <th class="sticky-col">指标</th>
                    <th
                      v-for="g in resp.groups"
                      :key="g.index"
                      :class="{ 'base-col': g.index === resp.baseline_index, 'skip-col': g.status === 'skipped' }"
                    >
                      <div class="th-name">
                        <el-tag v-if="g.index === resp.baseline_index" size="small" type="success">基准</el-tag>
                        <span>{{ g.name }}</span>
                      </div>
                      <div class="th-sub">{{ fmtTime(g.start).slice(3) }}~{{ fmtTime(g.end).slice(3) }}</div>
                      <div v-if="g.status === 'ok'" class="th-dev">
                        {{ g.device_types.length ? g.device_types.join('/') + ' ' : '' }}{{ deviceSummary(g) }}
                      </div>
                      <div v-else class="th-dev skip-text">已跳过</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="key in METRIC_KEYS" :key="key">
                    <td class="sticky-col metric-name">{{ METRIC_META[key].label }}</td>
                    <td
                      v-for="g in resp.groups"
                      :key="g.index"
                      :class="{ 'base-col': g.index === resp.baseline_index, 'skip-col': g.status === 'skipped' }"
                    >
                      <template v-if="g.status === 'ok'">
                        <div class="cell-val">{{ formatMetric(g, key) }}</div>
                        <div
                          v-if="g.index !== resp.baseline_index"
                          class="cell-diff"
                          :class="diffClass(g, key)"
                        >
                          {{ formatDiff(g, key) }}
                        </div>
                        <div v-else class="cell-diff base-mark">基准</div>
                      </template>
                      <span v-else class="cell-skip">—</span>
                    </td>
                  </tr>
                  <!-- 统计口径行 -->
                  <tr class="caliber-row">
                    <td class="sticky-col metric-name dim">统计口径</td>
                    <td
                      v-for="g in resp.groups"
                      :key="g.index"
                      :class="{ 'skip-col': g.status === 'skipped' }"
                    >
                      <span v-if="g.status === 'ok'" :title="g.metrics!.caliber.window" class="cal-window">
                        区间末快照−区间前基线，按设备求和
                      </span>
                      <span v-else>—</span>
                    </td>
                  </tr>
                  <tr class="caliber-row" v-for="cKey in CALIBER_KEYS" :key="cKey">
                    <td class="sticky-col metric-name dim">{{ CALIBER_META[cKey].label }}</td>
                    <td
                      v-for="g in resp.groups"
                      :key="g.index"
                      :class="{ 'skip-col': g.status === 'skipped' }"
                    >
                      {{ g.status === 'ok' ? formatCaliber(g, cKey) : '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 按指标查看：多组对比 -->
            <div class="metric-view">
              <div class="mv-head">
                <span class="mv-title">按统计指标查看</span>
                <el-radio-group v-model="store.metric" size="small">
                  <el-radio-button v-for="key in METRIC_KEYS" :key="key" :value="key">
                    {{ METRIC_META[key].label }}
                  </el-radio-button>
                </el-radio-group>
              </div>
              <div class="mv-pick">
                <span class="mv-title">选择对比组（多选）：</span>
                <el-checkbox
                  v-for="g in selectableGroups"
                  :key="g.index"
                  :model-value="store.selected.includes(g.index)"
                  @change="store.toggleSelected(g.index)"
                >
                  <span :class="{ 'is-base': g.index === resp.baseline_index }">{{ g.name }}</span>
                </el-checkbox>
                <el-button size="small" text type="primary" @click="selectAll">全选</el-button>
                <el-button size="small" text type="info" @click="store.selected = []">清空</el-button>
              </div>
              <div ref="chartEl" class="mv-chart"></div>
            </div>
          </template>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { useFactoryStore } from '../store/factory'
import { useCompareStore } from '../store/compare'
import CompareGroupEditor from './CompareGroupEditor.vue'
import type { CompareGroupResult } from '@/types'

const factory = useFactoryStore()
const store = useCompareStore()

const devices = computed(() => factory.data?.devices || [])
const deviceTypes = computed(() => {
  const set = new Set(devices.value.map((d) => d.type))
  return Array.from(set).sort()
})

const resp = computed(() => store.result)
const validGroups = computed(() => resp.value?.groups.filter((g) => g.status === 'ok') || [])
const skippedGroups = computed(() => resp.value?.groups.filter((g) => g.status === 'skipped') || [])
const truncatedGroups = computed(() => resp.value?.groups.filter((g) => g.truncated_to) || [])
const firstValid = computed(() => validGroups.value[0] || null)
const selectableGroups = computed(() => validGroups.value)

// ---- 指标元数据 ----
const METRIC_KEYS = ['production', 'faults', 'production_per_hour', 'faults_per_1000', 'running_ratio', 'avg_quality'] as const
type MetricKey = typeof METRIC_KEYS[number]
const METRIC_META: Record<MetricKey, { label: string; unit: string; percent: boolean; higherGood: boolean; digits: number }> = {
  production: { label: '产量', unit: '件', percent: false, higherGood: true, digits: 0 },
  faults: { label: '故障次数', unit: '次', percent: false, higherGood: false, digits: 0 },
  production_per_hour: { label: '小时产量', unit: '件/小时', percent: false, higherGood: true, digits: 1 },
  faults_per_1000: { label: '千件故障数', unit: '次/千件', percent: false, higherGood: false, digits: 2 },
  running_ratio: { label: '运行占比', unit: '%', percent: true, higherGood: true, digits: 1 },
  avg_quality: { label: '平均良品率', unit: '%', percent: true, higherGood: true, digits: 2 },
}

const CALIBER_KEYS = ['sample_points', 'total_samples', 'device_count', 'span_minutes'] as const
const CALIBER_META: Record<string, { label: string }> = {
  sample_points: { label: '采样点数' },
  total_samples: { label: '样本数（设备×采样）' },
  device_count: { label: '设备数' },
  span_minutes: { label: '时间跨度(分)' },
}

function metricValue(g: CompareGroupResult, key: string): number | null {
  return g.metrics ? (g.metrics as any)[key] : null
}

function formatMetric(g: CompareGroupResult, key: string): string {
  const v = metricValue(g, key)
  if (v === null || v === undefined) return '—'
  const meta = METRIC_META[key as MetricKey]
  const val = meta.percent ? v * 100 : v
  return val.toFixed(meta.digits)
}

function formatCaliber(g: CompareGroupResult, key: string): string {
  const v = (g.metrics!.caliber as any)[key]
  return key === 'span_minutes' ? Number(v).toFixed(1) : String(v)
}

function formatDiff(g: CompareGroupResult, key: string): string {
  const d = g.diff?.[key]
  if (d === null || d === undefined) return '—'
  const meta = METRIC_META[key as MetricKey]
  const delta = meta.percent ? d * 100 : d
  const pp = meta.percent ? ' pp' : ''
  const sign = delta > 0 ? '+' : ''
  let pct = ''
  const baseGroup = resp.value?.groups[resp.value.baseline_index]
  const bv = baseGroup ? metricValue(baseGroup, key) : null
  if (bv !== null && bv !== undefined && bv !== 0) {
    pct = ` (${((d / bv) * 100).toFixed(1)}%)`
  }
  return `${sign}${delta.toFixed(meta.digits)}${pp}${pct}`
}

function diffClass(g: CompareGroupResult, key: string): string {
  const d = g.diff?.[key]
  if (d === null || d === undefined || d === 0) return 'diff-zero'
  const good = METRIC_META[key as MetricKey].higherGood
  return (d > 0) === good ? 'diff-up-good' : 'diff-up-bad'
}

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

function deviceSummary(g: CompareGroupResult): string {
  if (!g.device_ids.length) return '全部设备'
  if (g.device_ids.length <= 4) return '#' + g.device_ids.join('、#')
  return `${g.device_ids.length} 台设备`
}

async function onRunSingle() {
  try { await store.runSingle() } catch { /* 错误已在 store 记录 */ }
  finally { nextTick(renderChart) }
}
async function onRunBatch() {
  try { await store.runBatch() } catch { /* 错误已在 store 记录 */ }
  finally { nextTick(renderChart) }
}

// ---- 按指标查看的柱状图 ----
const chartEl = ref<HTMLDivElement>()
let inst: echarts.ECharts | null = null

function renderChart() {
  if (store.mode !== 'batch' || store.view !== 'result' || !resp.value) return
  if (!chartEl.value) return
  if (!inst) inst = echarts.init(chartEl.value)

  const groups = resp.value.groups.filter(
    (g) => g.status === 'ok' && store.selected.includes(g.index),
  )
  const key = store.metric as MetricKey
  const meta = METRIC_META[key]
  const baseIndex = resp.value.baseline_index

  inst.setOption({
    backgroundColor: 'transparent',
    grid: { left: 55, right: 20, top: 30, bottom: 55 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0]
        const g = groups[p.dataIndex]
        const lines = [
          `<b>${g.name}${g.index === baseIndex ? '（基准）' : ''}</b>`,
          `${meta.label}: ${formatMetric(g, key)} ${meta.unit}`,
        ]
        if (g.index !== baseIndex) lines.push(`差异: ${formatDiff(g, key)}`)
        return lines.join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: groups.map((g) => g.name),
      axisLabel: { color: '#94a3b8', fontSize: 11, rotate: groups.length > 5 ? 20 : 0 },
    },
    yAxis: {
      type: 'value',
      name: meta.unit,
      axisLabel: {
        color: '#94a3b8',
        formatter: (v: number) => (meta.percent ? `${(v * 100).toFixed(0)}%` : String(v)),
      },
      nameTextStyle: { color: '#94a3b8' },
    },
    series: [
      {
        type: 'bar',
        data: groups.map((g) => ({
          value: metricValue(g, key),
          itemStyle: {
            color: g.index === baseIndex ? '#22c55e' : '#3b82f6',
            opacity: g.index === baseIndex ? 1 : 0.85,
          },
        })),
        barMaxWidth: 56,
        label: {
          show: true, position: 'top', color: '#cbd5e1', fontSize: 10,
          formatter: (p: any) => formatMetric(groups[p.dataIndex], key),
        },
        markLine:
          baseIndex >= 0 && groups.some((g) => g.index === baseIndex)
            ? {
                symbol: 'none',
                lineStyle: { color: '#22c55e', type: 'dashed' },
                label: { color: '#22c55e', formatter: '基准' },
                data: [{ xAxis: groups.findIndex((g) => g.index === baseIndex) }],
              }
            : undefined,
      },
    ],
    animation: false,
  }, true)
  inst.resize()
}

function onResize() { inst?.resize() }

function selectAll() {
  store.selected = selectableGroups.value.map((g) => g.index)
}

watch(() => [store.metric, store.selected, store.view, store.result], () => nextTick(renderChart), { deep: true })
onMounted(() => {
  // 结果数据只存于内存：刷新页面后回到设置页，但已持久化的组选择仍然保留
  if (store.view === 'result' && !store.result) store.backToSetup()
  window.addEventListener('resize', onResize)
  nextTick(renderChart)
})
onUnmounted(() => { window.removeEventListener('resize', onResize); inst?.dispose(); inst = null })

defineExpose({ renderChart })
</script>

<style scoped>
.compare-panel {
  background: #0d1b2a;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #1e3a5f;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.panel-head h4 { color: #64b5f6; font-size: 14px; }
.setup { display: flex; flex-direction: column; gap: 10px; }
.batch-group { display: flex; flex-direction: column; gap: 4px; }
.group-title { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; }
.is-base { color: #22c55e; font-weight: 700; }
.actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.hint { color: #64748b; font-size: 11px; }
.error-msg { color: #f87171; font-size: 12px; }
.alert { margin-bottom: 8px; }

.skip-box {
  background: #7f1d1d22;
  border: 1px solid #7f1d1d55;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.skip-title { color: #fca5a5; font-size: 12px; margin-bottom: 6px; }
.skip-item { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #cbd5e1; padding: 3px 0; flex-wrap: wrap; }
.skip-reason { color: #fca5a5; }
.skip-detail { display: inline-flex; gap: 4px; align-items: center; color: #94a3b8; }
.warn-box {
  background: #78350f22;
  border: 1px solid #b4530955;
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.warn-item { color: #fcd34d; font-size: 11px; }
.empty { color: #64748b; font-size: 12px; padding: 16px; text-align: center; }

.single-card { background: #112233; border-radius: 6px; padding: 12px; border: 1px solid #1e3a5f; }
.metric-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 10px; }
.metric-cell { background: #0d1b2a; border-radius: 6px; padding: 8px; text-align: center; border: 1px solid #1e3a5f; }
.m-label { color: #94a3b8; font-size: 11px; }
.m-value { color: #fbbf24; font-size: 18px; font-weight: 700; }
.m-unit { color: #64748b; font-size: 10px; }
.caliber { color: #94a3b8; font-size: 11px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.cal-title { color: #64b5f6; }

.table-wrap { overflow-x: auto; border: 1px solid #1e3a5f; border-radius: 6px; margin-bottom: 12px; }
.cmp-table { border-collapse: collapse; width: 100%; font-size: 11px; }
.cmp-table th, .cmp-table td {
  border: 1px solid #1e3a5f;
  padding: 6px 8px;
  text-align: center;
  min-width: 110px;
  vertical-align: middle;
}
.cmp-table thead th { background: #112233; color: #cbd5e1; position: sticky; top: 0; }
.sticky-col {
  position: sticky; left: 0; background: #0d1b2a; z-index: 2;
  text-align: left; min-width: 130px !important; font-weight: 600; color: #cbd5e1;
}
.metric-name { background: #112233; }
.dim { color: #64748b; font-weight: 400; }
.base-col { background: #14361f44; }
.skip-col { background: #1a1f2a; opacity: 0.7; }
.th-name { display: flex; gap: 4px; align-items: center; justify-content: center; }
.th-sub { font-size: 9px; color: #64748b; font-weight: 400; margin-top: 2px; }
.th-dev { font-size: 9px; color: #7dd3fc; font-weight: 400; margin-top: 1px; }
.th-dev.skip-text { color: #f87171; }
.cal-window { font-size: 9px; }
.cell-val { font-size: 14px; font-weight: 700; color: #e0e6ed; }
.cell-diff { font-size: 10px; margin-top: 2px; }
.diff-up-good { color: #22c55e; }
.diff-up-bad { color: #ef4444; }
.diff-zero { color: #64748b; }
.base-mark { color: #22c55e; }
.cell-skip { color: #475569; }
.caliber-row td { color: #94a3b8; font-size: 10px; }

.metric-view { background: #112233; border-radius: 6px; padding: 10px; border: 1px solid #1e3a5f; }
.mv-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.mv-pick { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; font-size: 11px; color: #94a3b8; }
.mv-title { color: #64b5f6; font-size: 12px; font-weight: 600; }
.mv-chart { width: 100%; height: 240px; }
</style>
