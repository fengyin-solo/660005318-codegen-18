/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { useFactoryStore } from '../store/factory';
const store = useFactoryStore();
const chart = ref();
let inst = null;
function update() {
    if (!inst || !store.data)
        return;
    const oee = store.data.oee;
    inst.setOption({
        backgroundColor: 'transparent', grid: { left: 30, right: 15, top: 10, bottom: 25 },
        xAxis: { type: 'category', data: oee.map(d => d.type + '-' + d.id), axisLabel: { color: '#94a3b8', fontSize: 9, rotate: 30 } },
        yAxis: { type: 'value', max: 100, axisLabel: { color: '#94a3b8' } },
        series: [
            { type: 'bar', data: oee.map(d => d.availability), name: '可用性', itemStyle: { color: '#22c55e' }, barGap: 0 },
            { type: 'bar', data: oee.map(d => d.performance), name: '性能', itemStyle: { color: '#fbbf24' }, barGap: 0 },
            { type: 'bar', data: oee.map(d => d.quality), name: '质量', itemStyle: { color: '#3b82f6' }, barGap: 0 },
            { type: 'line', data: oee.map(d => d.oee), name: 'OEE', symbol: 'diamond', lineStyle: { color: '#f87171', width: 2 } }
        ],
        animation: false, legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 } }
    });
}
onMounted(() => { if (chart.value) {
    inst = echarts.init(chart.value);
    update();
} });
watch(() => store.data, update);
onUnmounted(() => inst?.dispose());
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['chart-panel']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "chart-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "chart",
    ...{ class: "chart" },
});
/** @type {typeof __VLS_ctx.chart} */ ;
/** @type {__VLS_StyleScopedClasses['chart-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['chart']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            chart: chart,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
