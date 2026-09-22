/// <reference types="../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, onUnmounted } from 'vue';
import FactoryScene from './components/FactoryScene.vue';
import DeviceList from './components/DeviceList.vue';
import AnomalyList from './components/AnomalyList.vue';
import OEEChart from './components/OEEChart.vue';
import TrendPanel from './components/TrendPanel.vue';
import FaultPie from './components/FaultPie.vue';
import ComparePanel from './components/ComparePanel.vue';
import { useFactoryStore } from './store/factory';
const store = useFactoryStore();
onMounted(() => store.connect());
onUnmounted(() => store.disconnect());
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app-root" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "top-bar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "ws-dot" },
    ...{ class: ({ on: __VLS_ctx.store.connected }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.store.connected ? '实时连接中' : '连接断开');
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "prod-count" },
});
(__VLS_ctx.store.data?.production || 0);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "main-grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "scene-col" },
});
/** @type {[typeof FactoryScene, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(FactoryScene, new FactoryScene({}));
const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-col" },
});
/** @type {[typeof DeviceList, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(DeviceList, new DeviceList({}));
const __VLS_4 = __VLS_3({}, ...__VLS_functionalComponentArgsRest(__VLS_3));
/** @type {[typeof AnomalyList, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(AnomalyList, new AnomalyList({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "dashboard-row" },
});
/** @type {[typeof OEEChart, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(OEEChart, new OEEChart({}));
const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
/** @type {[typeof TrendPanel, ]} */ ;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(TrendPanel, new TrendPanel({}));
const __VLS_13 = __VLS_12({}, ...__VLS_functionalComponentArgsRest(__VLS_12));
/** @type {[typeof FaultPie, ]} */ ;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(FaultPie, new FaultPie({}));
const __VLS_16 = __VLS_15({}, ...__VLS_functionalComponentArgsRest(__VLS_15));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "compare-row" },
});
/** @type {[typeof ComparePanel, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(ComparePanel, new ComparePanel({}));
const __VLS_19 = __VLS_18({}, ...__VLS_functionalComponentArgsRest(__VLS_18));
/** @type {__VLS_StyleScopedClasses['app-root']} */ ;
/** @type {__VLS_StyleScopedClasses['top-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['status-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ws-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['prod-count']} */ ;
/** @type {__VLS_StyleScopedClasses['main-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['scene-col']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-col']} */ ;
/** @type {__VLS_StyleScopedClasses['dashboard-row']} */ ;
/** @type {__VLS_StyleScopedClasses['compare-row']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            FactoryScene: FactoryScene,
            DeviceList: DeviceList,
            AnomalyList: AnomalyList,
            OEEChart: OEEChart,
            TrendPanel: TrendPanel,
            FaultPie: FaultPie,
            ComparePanel: ComparePanel,
            store: store,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
