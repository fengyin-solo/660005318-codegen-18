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

// ---- 产量批量对比 ----
export interface CompareCaliber {
  sample_points: number
  total_samples: number
  device_count: number
  span_minutes: number
  window: string
}

export interface CompareMetrics {
  production: number
  faults: number
  faults_per_1000: number | null
  production_per_hour: number | null
  running_ratio: number | null
  avg_quality: number
  caliber: CompareCaliber
}

export interface CompareGroupResult {
  index: number
  name: string
  start: number
  end: number
  device_ids: number[]
  device_types: string[]
  status: 'ok' | 'skipped'
  skip_reason: string | null
  overlap_with: string[]
  unknown_device_ids: number[]
  metrics: CompareMetrics | null
  diff: Record<string, number | null> | null
  truncated_to?: number
}

export interface CompareResponse {
  server_time: number
  baseline_index: number
  baseline_requested: number
  baseline_fallback: boolean
  groups: CompareGroupResult[]
}

/** 对比组草稿（提交参数） */
export interface CompareGroupDraft {
  name: string
  range: [Date, Date]
  device_ids: number[]
  device_types: string[]
}

export const DEVICE_COLORS: Record<string, string> = {
  CNC: '#e74c3c', RobotArm: '#3498db', Conveyor: '#f39c12',
  AGV: '#2ecc71', InjectionMolding: '#9b59b6', QCStation: '#1abc9c'
}

export const STATUS_COLORS: Record<string, string> = {
  RUNNING: '#2ecc71', IDLE: '#f1c40f', FAULT: '#e74c3c', OFFLINE: '#95a5a6'
}