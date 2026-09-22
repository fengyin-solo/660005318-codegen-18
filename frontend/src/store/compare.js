import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import axios from 'axios';
const STORAGE_KEY = 'production-compare-state-v1';
/** 以“当前时间”为基准的快捷范围（秒） */
export const RANGE_PRESETS = [
    { label: '近30秒', seconds: 30 },
    { label: '近1分钟', seconds: 60 },
    { label: '近2分钟', seconds: 120 },
    { label: '近5分钟', seconds: 300 },
    { label: '近10分钟', seconds: 600 },
];
function nowRange(seconds) {
    const end = Date.now();
    return [new Date(end - seconds * 1000), new Date(end)];
}
/** 把持久化的时间戳还原为 Date */
function hydrateDraft(d) {
    return {
        name: String(d?.name ?? ''),
        range: Array.isArray(d?.range)
            ? [new Date(d.range[0]), new Date(d.range[1])]
            : nowRange(60),
        device_ids: Array.isArray(d?.device_ids) ? d.device_ids : [],
        device_types: Array.isArray(d?.device_types) ? d.device_types : [],
    };
}
function defaultBatchGroups() {
    return [
        { name: '基准组', range: nowRange(120), device_ids: [], device_types: [] },
        { name: '对比组', range: [new Date(Date.now() - 240000), new Date(Date.now() - 120000)], device_ids: [], device_types: [] },
    ];
}
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    }
    catch {
        return {};
    }
}
export const useCompareStore = defineStore('compare', () => {
    const saved = loadState();
    const mode = ref(saved.mode === 'batch' ? 'batch' : 'single');
    const view = ref(saved.view === 'result' ? 'result' : 'setup');
    const single = ref(saved.single ? hydrateDraft(saved.single) : { name: '单次查看', range: nowRange(60), device_ids: [], device_types: [] });
    const batch = ref(Array.isArray(saved.batch) && saved.batch.length
        ? saved.batch.map(hydrateDraft)
        : defaultBatchGroups());
    const baselineIndex = ref(saved.baselineIndex ?? 0);
    const metric = ref(saved.metric ?? 'production');
    /** 按指标查看时勾选参与对比的组（按组 index） */
    const selected = ref(Array.isArray(saved.selected) ? saved.selected : []);
    const result = ref(null);
    const loading = ref(false);
    const error = ref(null);
    function persist() {
        const state = {
            mode: mode.value,
            view: view.value,
            single: single.value,
            batch: batch.value,
            baselineIndex: baselineIndex.value,
            metric: metric.value,
            selected: selected.value,
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
        catch {
            /* 存储不可用时静默降级为内存态 */
        }
    }
    // 任何选择变化都持久化，保证返回后恢复上一次选择
    watch([mode, view, single, batch, baselineIndex, metric, selected], persist, { deep: true });
    function addGroup() {
        if (batch.value.length >= 10)
            return;
        batch.value.push({
            name: `组${batch.value.length + 1}`,
            range: nowRange(60),
            device_ids: [],
            device_types: [],
        });
    }
    function removeGroup(index) {
        if (batch.value.length <= 1)
            return;
        batch.value.splice(index, 1);
        if (baselineIndex.value >= batch.value.length) {
            baselineIndex.value = batch.value.length - 1;
        }
    }
    async function runCompare(groups, baseline) {
        loading.value = true;
        error.value = null;
        try {
            const payload = {
                groups: groups.map((g, i) => ({
                    name: g.name || `组${i + 1}`,
                    start: Math.floor(g.range[0].getTime() / 1000),
                    end: Math.floor(g.range[1].getTime() / 1000),
                    device_ids: g.device_ids.length ? g.device_ids : null,
                    device_types: g.device_types.length ? g.device_types : null,
                })),
                baseline_index: baseline,
            };
            const { data } = await axios.post('/api/production/compare', payload);
            result.value = data;
            view.value = 'result';
            // 默认勾选所有有效组参与指标对比，保留上次仍有效的选择
            const valid = data.groups.filter((g) => g.status === 'ok').map((g) => g.index);
            const keep = selected.value.filter((i) => valid.includes(i));
            selected.value = keep.length ? keep : valid;
            return data;
        }
        catch (e) {
            error.value = e?.response?.data?.detail || e?.message || '对比请求失败';
            throw e;
        }
        finally {
            loading.value = false;
        }
    }
    async function runSingle() {
        return runCompare([single.value], 0);
    }
    async function runBatch() {
        return runCompare(batch.value, baselineIndex.value);
    }
    function backToSetup() {
        view.value = 'setup';
    }
    function toggleSelected(index) {
        const i = selected.value.indexOf(index);
        if (i >= 0)
            selected.value.splice(i, 1);
        else
            selected.value.push(index);
    }
    return {
        mode, view, single, batch, baselineIndex, metric, selected,
        result, loading, error,
        addGroup, removeGroup,
        runCompare, runSingle, runBatch, backToSetup, toggleSelected,
    };
});
