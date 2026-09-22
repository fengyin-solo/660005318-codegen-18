/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { computed } from 'vue';
import { useFactoryStore } from '../store/factory';
const store = useFactoryStore();
const anomalies = computed(() => store.data?.anomalies || []);
function ts(t) { return new Date(t * 1000).toLocaleTimeString(); }
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
if (!__VLS_ctx.anomalies.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty" },
    });
}
for (const [a, i] of __VLS_getVForSourceType((__VLS_ctx.anomalies))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (i),
        ...{ class: "anomaly-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "a-time" },
    });
    (__VLS_ctx.ts(a.timestamp));
    for (const [t] of __VLS_getVForSourceType((a.triggers))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            key: (t.rule),
            ...{ class: "a-tag" },
        });
        (t.rule);
        (t.value.toFixed(1));
    }
}
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
/** @type {__VLS_StyleScopedClasses['anomaly-row']} */ ;
/** @type {__VLS_StyleScopedClasses['a-time']} */ ;
/** @type {__VLS_StyleScopedClasses['a-tag']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            anomalies: anomalies,
            ts: ts,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
