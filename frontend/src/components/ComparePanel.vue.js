/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { useFactoryStore } from '../store/factory';
import { useCompareStore } from '../store/compare';
import CompareGroupEditor from './CompareGroupEditor.vue';
const factory = useFactoryStore();
const store = useCompareStore();
const devices = computed(() => factory.data?.devices || []);
const deviceTypes = computed(() => {
    const set = new Set(devices.value.map((d) => d.type));
    return Array.from(set).sort();
});
const resp = computed(() => store.result);
const validGroups = computed(() => resp.value?.groups.filter((g) => g.status === 'ok') || []);
const skippedGroups = computed(() => resp.value?.groups.filter((g) => g.status === 'skipped') || []);
const truncatedGroups = computed(() => resp.value?.groups.filter((g) => g.truncated_to) || []);
const firstValid = computed(() => validGroups.value[0] || null);
const selectableGroups = computed(() => validGroups.value);
// ---- 指标元数据 ----
const METRIC_KEYS = ['production', 'faults', 'production_per_hour', 'faults_per_1000', 'running_ratio', 'avg_quality'];
const METRIC_META = {
    production: { label: '产量', unit: '件', percent: false, higherGood: true, digits: 0 },
    faults: { label: '故障次数', unit: '次', percent: false, higherGood: false, digits: 0 },
    production_per_hour: { label: '小时产量', unit: '件/小时', percent: false, higherGood: true, digits: 1 },
    faults_per_1000: { label: '千件故障数', unit: '次/千件', percent: false, higherGood: false, digits: 2 },
    running_ratio: { label: '运行占比', unit: '%', percent: true, higherGood: true, digits: 1 },
    avg_quality: { label: '平均良品率', unit: '%', percent: true, higherGood: true, digits: 2 },
};
const CALIBER_KEYS = ['sample_points', 'total_samples', 'device_count', 'span_minutes'];
const CALIBER_META = {
    sample_points: { label: '采样点数' },
    total_samples: { label: '样本数（设备×采样）' },
    device_count: { label: '设备数' },
    span_minutes: { label: '时间跨度(分)' },
};
function metricValue(g, key) {
    return g.metrics ? g.metrics[key] : null;
}
function formatMetric(g, key) {
    const v = metricValue(g, key);
    if (v === null || v === undefined)
        return '—';
    const meta = METRIC_META[key];
    const val = meta.percent ? v * 100 : v;
    return val.toFixed(meta.digits);
}
function formatCaliber(g, key) {
    const v = g.metrics.caliber[key];
    return key === 'span_minutes' ? Number(v).toFixed(1) : String(v);
}
function formatDiff(g, key) {
    const d = g.diff?.[key];
    if (d === null || d === undefined)
        return '—';
    const meta = METRIC_META[key];
    const delta = meta.percent ? d * 100 : d;
    const pp = meta.percent ? ' pp' : '';
    const sign = delta > 0 ? '+' : '';
    let pct = '';
    const baseGroup = resp.value?.groups[resp.value.baseline_index];
    const bv = baseGroup ? metricValue(baseGroup, key) : null;
    if (bv !== null && bv !== undefined && bv !== 0) {
        pct = ` (${((d / bv) * 100).toFixed(1)}%)`;
    }
    return `${sign}${delta.toFixed(meta.digits)}${pp}${pct}`;
}
function diffClass(g, key) {
    const d = g.diff?.[key];
    if (d === null || d === undefined || d === 0)
        return 'diff-zero';
    const good = METRIC_META[key].higherGood;
    return (d > 0) === good ? 'diff-up-good' : 'diff-up-bad';
}
function fmtTime(ts) {
    return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false });
}
function deviceSummary(g) {
    if (!g.device_ids.length)
        return '全部设备';
    if (g.device_ids.length <= 4)
        return '#' + g.device_ids.join('、#');
    return `${g.device_ids.length} 台设备`;
}
async function onRunSingle() {
    try {
        await store.runSingle();
    }
    catch { /* 错误已在 store 记录 */ }
    finally {
        nextTick(renderChart);
    }
}
async function onRunBatch() {
    try {
        await store.runBatch();
    }
    catch { /* 错误已在 store 记录 */ }
    finally {
        nextTick(renderChart);
    }
}
// ---- 按指标查看的柱状图 ----
const chartEl = ref();
let inst = null;
function renderChart() {
    if (store.mode !== 'batch' || store.view !== 'result' || !resp.value)
        return;
    if (!chartEl.value)
        return;
    if (!inst)
        inst = echarts.init(chartEl.value);
    const groups = resp.value.groups.filter((g) => g.status === 'ok' && store.selected.includes(g.index));
    const key = store.metric;
    const meta = METRIC_META[key];
    const baseIndex = resp.value.baseline_index;
    inst.setOption({
        backgroundColor: 'transparent',
        grid: { left: 55, right: 20, top: 30, bottom: 55 },
        tooltip: {
            trigger: 'axis',
            formatter: (params) => {
                const p = params[0];
                const g = groups[p.dataIndex];
                const lines = [
                    `<b>${g.name}${g.index === baseIndex ? '（基准）' : ''}</b>`,
                    `${meta.label}: ${formatMetric(g, key)} ${meta.unit}`,
                ];
                if (g.index !== baseIndex)
                    lines.push(`差异: ${formatDiff(g, key)}`);
                return lines.join('<br/>');
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
                formatter: (v) => (meta.percent ? `${(v * 100).toFixed(0)}%` : String(v)),
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
                    formatter: (p) => formatMetric(groups[p.dataIndex], key),
                },
                markLine: baseIndex >= 0 && groups.some((g) => g.index === baseIndex)
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
    }, true);
    inst.resize();
}
function onResize() { inst?.resize(); }
function selectAll() {
    store.selected = selectableGroups.value.map((g) => g.index);
}
watch(() => [store.metric, store.selected, store.view, store.result], () => nextTick(renderChart), { deep: true });
onMounted(() => {
    // 结果数据只存于内存：刷新页面后回到设置页，但已持久化的组选择仍然保留
    if (store.view === 'result' && !store.result)
        store.backToSetup();
    window.addEventListener('resize', onResize);
    nextTick(renderChart);
});
onUnmounted(() => { window.removeEventListener('resize', onResize); inst?.dispose(); inst = null; });
const __VLS_exposed = { renderChart };
defineExpose(__VLS_exposed);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['cmp-table']} */ ;
/** @type {__VLS_StyleScopedClasses['cmp-table']} */ ;
/** @type {__VLS_StyleScopedClasses['cmp-table']} */ ;
/** @type {__VLS_StyleScopedClasses['th-dev']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "compare-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
if (__VLS_ctx.store.view === 'setup') {
    const __VLS_0 = {}.ElRadioGroup;
    /** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        modelValue: (__VLS_ctx.store.mode),
        size: "small",
    }));
    const __VLS_2 = __VLS_1({
        modelValue: (__VLS_ctx.store.mode),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_3.slots.default;
    const __VLS_4 = {}.ElRadioButton;
    /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        value: "single",
    }));
    const __VLS_6 = __VLS_5({
        value: "single",
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_7.slots.default;
    var __VLS_7;
    const __VLS_8 = {}.ElRadioButton;
    /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        value: "batch",
    }));
    const __VLS_10 = __VLS_9({
        value: "batch",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_11.slots.default;
    var __VLS_11;
    var __VLS_3;
}
if (__VLS_ctx.store.view === 'result') {
    const __VLS_12 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        ...{ 'onClick': {} },
        size: "small",
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onClick': {} },
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_16;
    let __VLS_17;
    let __VLS_18;
    const __VLS_19 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.store.view === 'result'))
                return;
            __VLS_ctx.store.backToSetup();
        }
    };
    __VLS_15.slots.default;
    var __VLS_15;
}
if (__VLS_ctx.store.view === 'setup') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "setup" },
    });
    if (__VLS_ctx.store.mode === 'single') {
        /** @type {[typeof CompareGroupEditor, ]} */ ;
        // @ts-ignore
        const __VLS_20 = __VLS_asFunctionalComponent(CompareGroupEditor, new CompareGroupEditor({
            draft: (__VLS_ctx.store.single),
            index: (0),
            devices: (__VLS_ctx.devices),
            deviceTypes: (__VLS_ctx.deviceTypes),
        }));
        const __VLS_21 = __VLS_20({
            draft: (__VLS_ctx.store.single),
            index: (0),
            devices: (__VLS_ctx.devices),
            deviceTypes: (__VLS_ctx.deviceTypes),
        }, ...__VLS_functionalComponentArgsRest(__VLS_20));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "actions" },
        });
        const __VLS_23 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({
            ...{ 'onClick': {} },
            type: "primary",
            size: "small",
            loading: (__VLS_ctx.store.loading),
        }));
        const __VLS_25 = __VLS_24({
            ...{ 'onClick': {} },
            type: "primary",
            size: "small",
            loading: (__VLS_ctx.store.loading),
        }, ...__VLS_functionalComponentArgsRest(__VLS_24));
        let __VLS_27;
        let __VLS_28;
        let __VLS_29;
        const __VLS_30 = {
            onClick: (__VLS_ctx.onRunSingle)
        };
        __VLS_26.slots.default;
        var __VLS_26;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "hint" },
        });
    }
    else {
        for (const [g, i] of __VLS_getVForSourceType((__VLS_ctx.store.batch))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (i),
                ...{ class: "batch-group" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "group-title" },
            });
            const __VLS_31 = {}.ElRadio;
            /** @type {[typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, typeof __VLS_components.ElRadio, typeof __VLS_components.elRadio, ]} */ ;
            // @ts-ignore
            const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({
                ...{ 'onChange': {} },
                modelValue: (__VLS_ctx.store.baselineIndex),
                value: (i),
            }));
            const __VLS_33 = __VLS_32({
                ...{ 'onChange': {} },
                modelValue: (__VLS_ctx.store.baselineIndex),
                value: (i),
            }, ...__VLS_functionalComponentArgsRest(__VLS_32));
            let __VLS_35;
            let __VLS_36;
            let __VLS_37;
            const __VLS_38 = {
                onChange: (...[$event]) => {
                    if (!(__VLS_ctx.store.view === 'setup'))
                        return;
                    if (!!(__VLS_ctx.store.mode === 'single'))
                        return;
                    __VLS_ctx.store.baselineIndex = i;
                }
            };
            __VLS_34.slots.default;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: ({ 'is-base': __VLS_ctx.store.baselineIndex === i }) },
            });
            var __VLS_34;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "g-index" },
            });
            (i + 1);
            /** @type {[typeof CompareGroupEditor, ]} */ ;
            // @ts-ignore
            const __VLS_39 = __VLS_asFunctionalComponent(CompareGroupEditor, new CompareGroupEditor({
                ...{ 'onRemove': {} },
                draft: (g),
                index: (i),
                devices: (__VLS_ctx.devices),
                deviceTypes: (__VLS_ctx.deviceTypes),
                removable: (__VLS_ctx.store.batch.length > 1),
            }));
            const __VLS_40 = __VLS_39({
                ...{ 'onRemove': {} },
                draft: (g),
                index: (i),
                devices: (__VLS_ctx.devices),
                deviceTypes: (__VLS_ctx.deviceTypes),
                removable: (__VLS_ctx.store.batch.length > 1),
            }, ...__VLS_functionalComponentArgsRest(__VLS_39));
            let __VLS_42;
            let __VLS_43;
            let __VLS_44;
            const __VLS_45 = {
                onRemove: (...[$event]) => {
                    if (!(__VLS_ctx.store.view === 'setup'))
                        return;
                    if (!!(__VLS_ctx.store.mode === 'single'))
                        return;
                    __VLS_ctx.store.removeGroup(i);
                }
            };
            var __VLS_41;
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "actions" },
        });
        const __VLS_46 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_47 = __VLS_asFunctionalComponent(__VLS_46, new __VLS_46({
            ...{ 'onClick': {} },
            size: "small",
            disabled: (__VLS_ctx.store.batch.length >= 10),
        }));
        const __VLS_48 = __VLS_47({
            ...{ 'onClick': {} },
            size: "small",
            disabled: (__VLS_ctx.store.batch.length >= 10),
        }, ...__VLS_functionalComponentArgsRest(__VLS_47));
        let __VLS_50;
        let __VLS_51;
        let __VLS_52;
        const __VLS_53 = {
            onClick: (__VLS_ctx.store.addGroup)
        };
        __VLS_49.slots.default;
        var __VLS_49;
        const __VLS_54 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_55 = __VLS_asFunctionalComponent(__VLS_54, new __VLS_54({
            ...{ 'onClick': {} },
            type: "primary",
            size: "small",
            loading: (__VLS_ctx.store.loading),
        }));
        const __VLS_56 = __VLS_55({
            ...{ 'onClick': {} },
            type: "primary",
            size: "small",
            loading: (__VLS_ctx.store.loading),
        }, ...__VLS_functionalComponentArgsRest(__VLS_55));
        let __VLS_58;
        let __VLS_59;
        let __VLS_60;
        const __VLS_61 = {
            onClick: (__VLS_ctx.onRunBatch)
        };
        __VLS_57.slots.default;
        (__VLS_ctx.store.batch.length);
        var __VLS_57;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "hint" },
        });
    }
    if (__VLS_ctx.store.error) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "error-msg" },
        });
        (__VLS_ctx.store.error);
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "result" },
    });
    if (__VLS_ctx.resp) {
        if (__VLS_ctx.resp.baseline_fallback) {
            const __VLS_62 = {}.ElAlert;
            /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
            // @ts-ignore
            const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({
                type: "warning",
                closable: (false),
                showIcon: true,
                ...{ class: "alert" },
                title: (`指定的基准组（组${__VLS_ctx.resp.baseline_requested + 1}）无效，已自动以组${__VLS_ctx.resp.baseline_index + 1}为基准。`),
            }));
            const __VLS_64 = __VLS_63({
                type: "warning",
                closable: (false),
                showIcon: true,
                ...{ class: "alert" },
                title: (`指定的基准组（组${__VLS_ctx.resp.baseline_requested + 1}）无效，已自动以组${__VLS_ctx.resp.baseline_index + 1}为基准。`),
            }, ...__VLS_functionalComponentArgsRest(__VLS_63));
        }
        if (__VLS_ctx.skippedGroups.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "skip-box" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "skip-title" },
            });
            for (const [g] of __VLS_getVForSourceType((__VLS_ctx.skippedGroups))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (g.index),
                    ...{ class: "skip-item" },
                });
                const __VLS_66 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({
                    type: "info",
                    size: "small",
                }));
                const __VLS_68 = __VLS_67({
                    type: "info",
                    size: "small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                __VLS_69.slots.default;
                (g.name);
                var __VLS_69;
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "skip-reason" },
                });
                (g.skip_reason);
                if (g.overlap_with.length) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                        ...{ class: "skip-detail" },
                    });
                    for (const [n] of __VLS_getVForSourceType((g.overlap_with))) {
                        const __VLS_70 = {}.ElTag;
                        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                        // @ts-ignore
                        const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
                            key: (n),
                            size: "small",
                            type: "warning",
                        }));
                        const __VLS_72 = __VLS_71({
                            key: (n),
                            size: "small",
                            type: "warning",
                        }, ...__VLS_functionalComponentArgsRest(__VLS_71));
                        __VLS_73.slots.default;
                        (n);
                        var __VLS_73;
                    }
                }
                if (g.unknown_device_ids.length) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                        ...{ class: "skip-detail" },
                    });
                    (g.unknown_device_ids.join(', '));
                }
            }
        }
        if (__VLS_ctx.truncatedGroups.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "warn-box" },
            });
            for (const [g] of __VLS_getVForSourceType((__VLS_ctx.truncatedGroups))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    key: (g.index),
                    ...{ class: "warn-item" },
                });
                (g.name);
                (__VLS_ctx.fmtTime(g.truncated_to));
            }
        }
        if (!__VLS_ctx.validGroups.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "empty" },
            });
        }
        else {
            if (__VLS_ctx.store.mode === 'single' && __VLS_ctx.firstValid) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "single-card" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "metric-grid" },
                });
                for (const [key] of __VLS_getVForSourceType((__VLS_ctx.METRIC_KEYS))) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        key: (key),
                        ...{ class: "metric-cell" },
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "m-label" },
                    });
                    (__VLS_ctx.METRIC_META[key].label);
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "m-value" },
                    });
                    (__VLS_ctx.formatMetric(__VLS_ctx.firstValid, key));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "m-unit" },
                    });
                    (__VLS_ctx.METRIC_META[key].unit);
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "caliber" },
                });
                if (__VLS_ctx.firstValid.metrics) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                        ...{ class: "cal-title" },
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.firstValid.metrics.caliber.window);
                    const __VLS_74 = {}.ElDivider;
                    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
                    // @ts-ignore
                    const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({
                        direction: "vertical",
                    }));
                    const __VLS_76 = __VLS_75({
                        direction: "vertical",
                    }, ...__VLS_functionalComponentArgsRest(__VLS_75));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.firstValid.metrics.caliber.sample_points);
                    const __VLS_78 = {}.ElDivider;
                    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
                    // @ts-ignore
                    const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
                        direction: "vertical",
                    }));
                    const __VLS_80 = __VLS_79({
                        direction: "vertical",
                    }, ...__VLS_functionalComponentArgsRest(__VLS_79));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.firstValid.metrics.caliber.total_samples);
                    const __VLS_82 = {}.ElDivider;
                    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
                    // @ts-ignore
                    const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({
                        direction: "vertical",
                    }));
                    const __VLS_84 = __VLS_83({
                        direction: "vertical",
                    }, ...__VLS_functionalComponentArgsRest(__VLS_83));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.firstValid.metrics.caliber.device_count);
                    const __VLS_86 = {}.ElDivider;
                    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
                    // @ts-ignore
                    const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({
                        direction: "vertical",
                    }));
                    const __VLS_88 = __VLS_87({
                        direction: "vertical",
                    }, ...__VLS_functionalComponentArgsRest(__VLS_87));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.firstValid.metrics.caliber.span_minutes.toFixed(1));
                    const __VLS_90 = {}.ElDivider;
                    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
                    // @ts-ignore
                    const __VLS_91 = __VLS_asFunctionalComponent(__VLS_90, new __VLS_90({
                        direction: "vertical",
                    }));
                    const __VLS_92 = __VLS_91({
                        direction: "vertical",
                    }, ...__VLS_functionalComponentArgsRest(__VLS_91));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.fmtTime(__VLS_ctx.firstValid.start));
                    (__VLS_ctx.fmtTime(__VLS_ctx.firstValid.end));
                    const __VLS_94 = {}.ElDivider;
                    /** @type {[typeof __VLS_components.ElDivider, typeof __VLS_components.elDivider, ]} */ ;
                    // @ts-ignore
                    const __VLS_95 = __VLS_asFunctionalComponent(__VLS_94, new __VLS_94({
                        direction: "vertical",
                    }));
                    const __VLS_96 = __VLS_95({
                        direction: "vertical",
                    }, ...__VLS_functionalComponentArgsRest(__VLS_95));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.firstValid.device_ids.join(', ') || '全部');
                }
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "table-wrap" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
                    ...{ class: "cmp-table" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
                    ...{ class: "sticky-col" },
                });
                for (const [g] of __VLS_getVForSourceType((__VLS_ctx.resp.groups))) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
                        key: (g.index),
                        ...{ class: ({ 'base-col': g.index === __VLS_ctx.resp.baseline_index, 'skip-col': g.status === 'skipped' }) },
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "th-name" },
                    });
                    if (g.index === __VLS_ctx.resp.baseline_index) {
                        const __VLS_98 = {}.ElTag;
                        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                        // @ts-ignore
                        const __VLS_99 = __VLS_asFunctionalComponent(__VLS_98, new __VLS_98({
                            size: "small",
                            type: "success",
                        }));
                        const __VLS_100 = __VLS_99({
                            size: "small",
                            type: "success",
                        }, ...__VLS_functionalComponentArgsRest(__VLS_99));
                        __VLS_101.slots.default;
                        var __VLS_101;
                    }
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (g.name);
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "th-sub" },
                    });
                    (__VLS_ctx.fmtTime(g.start).slice(3));
                    (__VLS_ctx.fmtTime(g.end).slice(3));
                    if (g.status === 'ok') {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                            ...{ class: "th-dev" },
                        });
                        (g.device_types.length ? g.device_types.join('/') + ' ' : '');
                        (__VLS_ctx.deviceSummary(g));
                    }
                    else {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                            ...{ class: "th-dev skip-text" },
                        });
                    }
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
                for (const [key] of __VLS_getVForSourceType((__VLS_ctx.METRIC_KEYS))) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                        key: (key),
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                        ...{ class: "sticky-col metric-name" },
                    });
                    (__VLS_ctx.METRIC_META[key].label);
                    for (const [g] of __VLS_getVForSourceType((__VLS_ctx.resp.groups))) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                            key: (g.index),
                            ...{ class: ({ 'base-col': g.index === __VLS_ctx.resp.baseline_index, 'skip-col': g.status === 'skipped' }) },
                        });
                        if (g.status === 'ok') {
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                                ...{ class: "cell-val" },
                            });
                            (__VLS_ctx.formatMetric(g, key));
                            if (g.index !== __VLS_ctx.resp.baseline_index) {
                                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                                    ...{ class: "cell-diff" },
                                    ...{ class: (__VLS_ctx.diffClass(g, key)) },
                                });
                                (__VLS_ctx.formatDiff(g, key));
                            }
                            else {
                                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                                    ...{ class: "cell-diff base-mark" },
                                });
                            }
                        }
                        else {
                            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                                ...{ class: "cell-skip" },
                            });
                        }
                    }
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                    ...{ class: "caliber-row" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                    ...{ class: "sticky-col metric-name dim" },
                });
                for (const [g] of __VLS_getVForSourceType((__VLS_ctx.resp.groups))) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                        key: (g.index),
                        ...{ class: ({ 'skip-col': g.status === 'skipped' }) },
                    });
                    if (g.status === 'ok') {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                            title: (g.metrics.caliber.window),
                            ...{ class: "cal-window" },
                        });
                    }
                    else {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    }
                }
                for (const [cKey] of __VLS_getVForSourceType((__VLS_ctx.CALIBER_KEYS))) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                        ...{ class: "caliber-row" },
                        key: (cKey),
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                        ...{ class: "sticky-col metric-name dim" },
                    });
                    (__VLS_ctx.CALIBER_META[cKey].label);
                    for (const [g] of __VLS_getVForSourceType((__VLS_ctx.resp.groups))) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                            key: (g.index),
                            ...{ class: ({ 'skip-col': g.status === 'skipped' }) },
                        });
                        (g.status === 'ok' ? __VLS_ctx.formatCaliber(g, cKey) : '—');
                    }
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "metric-view" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "mv-head" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "mv-title" },
                });
                const __VLS_102 = {}.ElRadioGroup;
                /** @type {[typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, typeof __VLS_components.ElRadioGroup, typeof __VLS_components.elRadioGroup, ]} */ ;
                // @ts-ignore
                const __VLS_103 = __VLS_asFunctionalComponent(__VLS_102, new __VLS_102({
                    modelValue: (__VLS_ctx.store.metric),
                    size: "small",
                }));
                const __VLS_104 = __VLS_103({
                    modelValue: (__VLS_ctx.store.metric),
                    size: "small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_103));
                __VLS_105.slots.default;
                for (const [key] of __VLS_getVForSourceType((__VLS_ctx.METRIC_KEYS))) {
                    const __VLS_106 = {}.ElRadioButton;
                    /** @type {[typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, typeof __VLS_components.ElRadioButton, typeof __VLS_components.elRadioButton, ]} */ ;
                    // @ts-ignore
                    const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
                        key: (key),
                        value: (key),
                    }));
                    const __VLS_108 = __VLS_107({
                        key: (key),
                        value: (key),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_107));
                    __VLS_109.slots.default;
                    (__VLS_ctx.METRIC_META[key].label);
                    var __VLS_109;
                }
                var __VLS_105;
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "mv-pick" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "mv-title" },
                });
                for (const [g] of __VLS_getVForSourceType((__VLS_ctx.selectableGroups))) {
                    const __VLS_110 = {}.ElCheckbox;
                    /** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
                    // @ts-ignore
                    const __VLS_111 = __VLS_asFunctionalComponent(__VLS_110, new __VLS_110({
                        ...{ 'onChange': {} },
                        key: (g.index),
                        modelValue: (__VLS_ctx.store.selected.includes(g.index)),
                    }));
                    const __VLS_112 = __VLS_111({
                        ...{ 'onChange': {} },
                        key: (g.index),
                        modelValue: (__VLS_ctx.store.selected.includes(g.index)),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_111));
                    let __VLS_114;
                    let __VLS_115;
                    let __VLS_116;
                    const __VLS_117 = {
                        onChange: (...[$event]) => {
                            if (!!(__VLS_ctx.store.view === 'setup'))
                                return;
                            if (!(__VLS_ctx.resp))
                                return;
                            if (!!(!__VLS_ctx.validGroups.length))
                                return;
                            if (!!(__VLS_ctx.store.mode === 'single' && __VLS_ctx.firstValid))
                                return;
                            __VLS_ctx.store.toggleSelected(g.index);
                        }
                    };
                    __VLS_113.slots.default;
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                        ...{ class: ({ 'is-base': g.index === __VLS_ctx.resp.baseline_index }) },
                    });
                    (g.name);
                    var __VLS_113;
                }
                const __VLS_118 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_119 = __VLS_asFunctionalComponent(__VLS_118, new __VLS_118({
                    ...{ 'onClick': {} },
                    size: "small",
                    text: true,
                    type: "primary",
                }));
                const __VLS_120 = __VLS_119({
                    ...{ 'onClick': {} },
                    size: "small",
                    text: true,
                    type: "primary",
                }, ...__VLS_functionalComponentArgsRest(__VLS_119));
                let __VLS_122;
                let __VLS_123;
                let __VLS_124;
                const __VLS_125 = {
                    onClick: (__VLS_ctx.selectAll)
                };
                __VLS_121.slots.default;
                var __VLS_121;
                const __VLS_126 = {}.ElButton;
                /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
                // @ts-ignore
                const __VLS_127 = __VLS_asFunctionalComponent(__VLS_126, new __VLS_126({
                    ...{ 'onClick': {} },
                    size: "small",
                    text: true,
                    type: "info",
                }));
                const __VLS_128 = __VLS_127({
                    ...{ 'onClick': {} },
                    size: "small",
                    text: true,
                    type: "info",
                }, ...__VLS_functionalComponentArgsRest(__VLS_127));
                let __VLS_130;
                let __VLS_131;
                let __VLS_132;
                const __VLS_133 = {
                    onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.store.view === 'setup'))
                            return;
                        if (!(__VLS_ctx.resp))
                            return;
                        if (!!(!__VLS_ctx.validGroups.length))
                            return;
                        if (!!(__VLS_ctx.store.mode === 'single' && __VLS_ctx.firstValid))
                            return;
                        __VLS_ctx.store.selected = [];
                    }
                };
                __VLS_129.slots.default;
                var __VLS_129;
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ref: "chartEl",
                    ...{ class: "mv-chart" },
                });
                /** @type {typeof __VLS_ctx.chartEl} */ ;
            }
        }
    }
}
/** @type {__VLS_StyleScopedClasses['compare-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['setup']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-group']} */ ;
/** @type {__VLS_StyleScopedClasses['group-title']} */ ;
/** @type {__VLS_StyleScopedClasses['g-index']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['error-msg']} */ ;
/** @type {__VLS_StyleScopedClasses['result']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['skip-box']} */ ;
/** @type {__VLS_StyleScopedClasses['skip-title']} */ ;
/** @type {__VLS_StyleScopedClasses['skip-item']} */ ;
/** @type {__VLS_StyleScopedClasses['skip-reason']} */ ;
/** @type {__VLS_StyleScopedClasses['skip-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['skip-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['warn-box']} */ ;
/** @type {__VLS_StyleScopedClasses['warn-item']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
/** @type {__VLS_StyleScopedClasses['single-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['m-label']} */ ;
/** @type {__VLS_StyleScopedClasses['m-value']} */ ;
/** @type {__VLS_StyleScopedClasses['m-unit']} */ ;
/** @type {__VLS_StyleScopedClasses['caliber']} */ ;
/** @type {__VLS_StyleScopedClasses['cal-title']} */ ;
/** @type {__VLS_StyleScopedClasses['table-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['cmp-table']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky-col']} */ ;
/** @type {__VLS_StyleScopedClasses['th-name']} */ ;
/** @type {__VLS_StyleScopedClasses['th-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['th-dev']} */ ;
/** @type {__VLS_StyleScopedClasses['th-dev']} */ ;
/** @type {__VLS_StyleScopedClasses['skip-text']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky-col']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-name']} */ ;
/** @type {__VLS_StyleScopedClasses['cell-val']} */ ;
/** @type {__VLS_StyleScopedClasses['cell-diff']} */ ;
/** @type {__VLS_StyleScopedClasses['cell-diff']} */ ;
/** @type {__VLS_StyleScopedClasses['base-mark']} */ ;
/** @type {__VLS_StyleScopedClasses['cell-skip']} */ ;
/** @type {__VLS_StyleScopedClasses['caliber-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky-col']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-name']} */ ;
/** @type {__VLS_StyleScopedClasses['dim']} */ ;
/** @type {__VLS_StyleScopedClasses['cal-window']} */ ;
/** @type {__VLS_StyleScopedClasses['caliber-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky-col']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-name']} */ ;
/** @type {__VLS_StyleScopedClasses['dim']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-view']} */ ;
/** @type {__VLS_StyleScopedClasses['mv-head']} */ ;
/** @type {__VLS_StyleScopedClasses['mv-title']} */ ;
/** @type {__VLS_StyleScopedClasses['mv-pick']} */ ;
/** @type {__VLS_StyleScopedClasses['mv-title']} */ ;
/** @type {__VLS_StyleScopedClasses['mv-chart']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CompareGroupEditor: CompareGroupEditor,
            store: store,
            devices: devices,
            deviceTypes: deviceTypes,
            resp: resp,
            validGroups: validGroups,
            skippedGroups: skippedGroups,
            truncatedGroups: truncatedGroups,
            firstValid: firstValid,
            selectableGroups: selectableGroups,
            METRIC_KEYS: METRIC_KEYS,
            METRIC_META: METRIC_META,
            CALIBER_KEYS: CALIBER_KEYS,
            CALIBER_META: CALIBER_META,
            formatMetric: formatMetric,
            formatCaliber: formatCaliber,
            formatDiff: formatDiff,
            diffClass: diffClass,
            fmtTime: fmtTime,
            deviceSummary: deviceSummary,
            onRunSingle: onRunSingle,
            onRunBatch: onRunBatch,
            chartEl: chartEl,
            selectAll: selectAll,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            ...__VLS_exposed,
        };
    },
});
; /* PartiallyEnd: #4569/main.vue */
