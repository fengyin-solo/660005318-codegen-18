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
    const ds = store.data.devices.slice(0, 4);
    inst.setOption({
        backgroundColor: 'transparent', grid: { left: 40, right: 15, top: 10, bottom: 25 },
        xAxis: { type: 'category', data: ds.map(d => d.type + '-' + d.id), axisLabel: { color: '#94a3b8', fontSize: 9, rotate: 20 } },
        yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
        series: [
            { type: 'bar', data: ds.map(d => d.temperature), name: '温度°C', itemStyle: { color: '#f97316' } },
            { type: 'line', data: ds.map(d => d.vibration * 20), name: '振动', itemStyle: { color: '#a78bfa' }, smooth: true }
        ], animation: false
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
