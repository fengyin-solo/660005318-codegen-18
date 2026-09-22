export interface Device {
  id: number; type: string; status: string; position: number[]
  temperature: number; vibration: number; pressure: number
  production_count: number; fault_count: number
  uptime: number; quality_rate: number
}

export interface Anomaly {
  timestamp: number; triggers: { device_id: number; rule: string; value: number; threshold: string }[]
  device_type: string
}

export interface OEEItem {
  id: number; type: string; oee: number
  availability: number; performance: number; quality: number
}

export interface FactoryData {
  devices: Device[]
  production: number
  anomalies: Anomaly[]
  oee: OEEItem[]
}

export const DEVICE_COLORS: Record<string, string> = {
  CNC: '#e74c3c', RobotArm: '#3498db', Conveyor: '#f39c12',
  AGV: '#2ecc71', InjectionMolding: '#9b59b6', QCStation: '#1abc9c'
}

export const STATUS_COLORS: Record<string, string> = {
  RUNNING: '#2ecc71', IDLE: '#f1c40f', FAULT: '#e74c3c', OFFLINE: '#95a5a6'
}

// ---- 产量批量对比 ----
export interface CompareGroupDef {
  name: string
  start: number  // epoch 秒
  end: number
  device_ids: number[]  // 空数组表示全部设备
}

export interface CompareResultItem {
  name: string; index: number
  production: number; faults: number
  device_ids: number[]; device_count: number
  sample_count: number
  actual_start: number; actual_end: number; duration: number
  production_diff: number; production_diff_pct: number | null; fault_diff: number
}

export interface CompareSkipped { name: string; reason: string }

export interface CompareResponse {
  baseline: string | null
  results: CompareResultItem[]
  skipped: CompareSkipped[]
}

export type CompareMetric = 'production' | 'faults' | 'sample_count' | 'duration'

export const COMPARE_METRICS: { key: CompareMetric; label: string }[] = [
  { key: 'production', label: '产量' },
  { key: 'faults', label: '故障次数' },
  { key: 'sample_count', label: '采样点数' },
  { key: 'duration', label: '统计时长(s)' },
]