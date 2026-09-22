/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { computed } from 'vue';
import { useFactoryStore } from '../store/factory';
import { STATUS_COLORS } from '../types';
const store = useFactoryStore();
const devices = computed(() => store.data?.devices || []);
function tagType(s) {
    const m = { RUNNING: 'success', IDLE: 'warning', FAULT: 'danger' };
    return m[s] || 'info';
}
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "dev-list" },
});
for (const [dev] of __VLS_getVForSourceType((__VLS_ctx.devices))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (dev.id),
        ...{ class: "dev-row" },
        ...{ style: ({ borderLeftColor: __VLS_ctx.STATUS_COLORS[dev.status] }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dev-info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "dev-type" },
    });
    (dev.type);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "dev-id" },
    });
    (dev.id);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dev-metrics" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "metric" },
    });
    (dev.temperature.toFixed(1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "metric" },
    });
    (dev.vibration.toFixed(2));
    const __VLS_0 = {}.ElTag;
    /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        size: "small",
        type: (__VLS_ctx.tagType(dev.status)),
    }));
    const __VLS_2 = __VLS_1({
        size: "small",
        type: (__VLS_ctx.tagType(dev.status)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_3.slots.default;
    (dev.status);
    var __VLS_3;
}
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['dev-list']} */ ;
/** @type {__VLS_StyleScopedClasses['dev-row']} */ ;
/** @type {__VLS_StyleScopedClasses['dev-info']} */ ;
/** @type {__VLS_StyleScopedClasses['dev-type']} */ ;
/** @type {__VLS_StyleScopedClasses['dev-id']} */ ;
/** @type {__VLS_StyleScopedClasses['dev-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            STATUS_COLORS: STATUS_COLORS,
            devices: devices,
            tagType: tagType,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
