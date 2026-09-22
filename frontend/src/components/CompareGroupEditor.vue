<template>
  <div class="group-editor">
    <div class="row">
      <el-input
        v-model="draft.name"
        size="small"
        class="name-input"
        :placeholder="`组${index + 1}`"
      />
      <el-date-picker
        v-model="draft.range"
        type="datetimerange"
        size="small"
        range-separator="至"
        start-placeholder="开始"
        end-placeholder="结束"
        :clearable="false"
        :shortcuts="shortcuts"
        format="MM-DD HH:mm:ss"
      />
      <el-button-group class="presets">
        <el-button
          v-for="p in RANGE_PRESETS"
          :key="p.seconds"
          size="small"
          @click="draft.range = makeRange(p.seconds)"
        >{{ p.label }}</el-button>
      </el-button-group>
    </div>
    <div class="row">
      <el-select
        v-model="draft.device_types"
        multiple
        collapse-tags
        collapse-tags-tooltip
        size="small"
        class="type-select"
        placeholder="设备类型（不选=不限）"
      >
        <el-option v-for="t in deviceTypes" :key="t" :label="t" :value="t" />
      </el-select>
      <el-select
        v-model="draft.device_ids"
        multiple
        collapse-tags
        collapse-tags-tooltip
        size="small"
        class="device-select"
        placeholder="具体设备（不选=按类型/全部）"
      >
        <el-option-group v-for="t in deviceTypes" :key="t" :label="t">
          <el-option
            v-for="d in devicesByType[t]"
            :key="d.id"
            :label="`${d.type} #${d.id}`"
            :value="d.id"
          />
        </el-option-group>
      </el-select>
      <el-button size="small" text type="info" @click="clearSelection">清空设备</el-button>
      <el-button v-if="removable" size="small" text type="danger" @click="emit('remove')">删除组</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CompareGroupDraft, Device } from '@/types'
import { RANGE_PRESETS } from '../store/compare'

const props = defineProps<{
  draft: CompareGroupDraft
  index: number
  devices: Device[]
  deviceTypes: string[]
  removable?: boolean
}>()

const emit = defineEmits<{ (e: 'remove'): void }>()

const devicesByType = computed<Record<string, Device[]>>(() => {
  const map: Record<string, Device[]> = {}
  for (const t of props.deviceTypes) map[t] = []
  for (const d of props.devices) {
    ;(map[d.type] ||= []).push(d)
  }
  return map
})

function makeRange(seconds: number): [Date, Date] {
  const end = Date.now()
  return [new Date(end - seconds * 1000), new Date(end)]
}

function clearSelection() {
  props.draft.device_ids = []
  props.draft.device_types = []
}

const shortcuts = [
  { text: '近1分钟', value: () => makeRange(60) },
  { text: '近2分钟', value: () => makeRange(120) },
  { text: '近5分钟', value: () => makeRange(300) },
  { text: '近10分钟', value: () => makeRange(600) },
]
</script>

<style scoped>
.group-editor {
  background: #112233;
  border: 1px solid #1e3a5f;
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.name-input { width: 110px; flex: none; }
.type-select { width: 200px; }
.device-select { min-width: 240px; flex: 1; }
.presets { flex: none; }
:deep(.el-range-editor) { width: 330px; }
</style>
