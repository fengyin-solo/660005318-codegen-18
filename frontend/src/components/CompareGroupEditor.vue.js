/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { computed } from 'vue';
import { RANGE_PRESETS } from '../store/compare';
const props = defineProps();
const emit = defineEmits();
const devicesByType = computed(() => {
    var _a;
    const map = {};
    for (const t of props.deviceTypes)
        map[t] = [];
    for (const d of props.devices) {
        ;
        (map[_a = d.type] || (map[_a] = [])).push(d);
    }
    return map;
});
function makeRange(seconds) {
    const end = Date.now();
    return [new Date(end - seconds * 1000), new Date(end)];
}
function clearSelection() {
    props.draft.device_ids = [];
    props.draft.device_types = [];
}
const shortcuts = [
    { text: '近1分钟', value: () => makeRange(60) },
    { text: '近2分钟', value: () => makeRange(120) },
    { text: '近5分钟', value: () => makeRange(300) },
    { text: '近10分钟', value: () => makeRange(600) },
];
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "group-editor" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "row" },
});
const __VLS_0 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.draft.name),
    size: "small",
    ...{ class: "name-input" },
    placeholder: (`组${__VLS_ctx.index + 1}`),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.draft.name),
    size: "small",
    ...{ class: "name-input" },
    placeholder: (`组${__VLS_ctx.index + 1}`),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_4 = {}.ElDatePicker;
/** @type {[typeof __VLS_components.ElDatePicker, typeof __VLS_components.elDatePicker, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    modelValue: (__VLS_ctx.draft.range),
    type: "datetimerange",
    size: "small",
    rangeSeparator: "至",
    startPlaceholder: "开始",
    endPlaceholder: "结束",
    clearable: (false),
    shortcuts: (__VLS_ctx.shortcuts),
    format: "MM-DD HH:mm:ss",
}));
const __VLS_6 = __VLS_5({
    modelValue: (__VLS_ctx.draft.range),
    type: "datetimerange",
    size: "small",
    rangeSeparator: "至",
    startPlaceholder: "开始",
    endPlaceholder: "结束",
    clearable: (false),
    shortcuts: (__VLS_ctx.shortcuts),
    format: "MM-DD HH:mm:ss",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
const __VLS_8 = {}.ElButtonGroup;
/** @type {[typeof __VLS_components.ElButtonGroup, typeof __VLS_components.elButtonGroup, typeof __VLS_components.ElButtonGroup, typeof __VLS_components.elButtonGroup, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ class: "presets" },
}));
const __VLS_10 = __VLS_9({
    ...{ class: "presets" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
for (const [p] of __VLS_getVForSourceType((__VLS_ctx.RANGE_PRESETS))) {
    const __VLS_12 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        ...{ 'onClick': {} },
        key: (p.seconds),
        size: "small",
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onClick': {} },
        key: (p.seconds),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_16;
    let __VLS_17;
    let __VLS_18;
    const __VLS_19 = {
        onClick: (...[$event]) => {
            __VLS_ctx.draft.range = __VLS_ctx.makeRange(p.seconds);
        }
    };
    __VLS_15.slots.default;
    (p.label);
    var __VLS_15;
}
var __VLS_11;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "row" },
});
const __VLS_20 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.draft.device_types),
    multiple: true,
    collapseTags: true,
    collapseTagsTooltip: true,
    size: "small",
    ...{ class: "type-select" },
    placeholder: "设备类型（不选=不限）",
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.draft.device_types),
    multiple: true,
    collapseTags: true,
    collapseTagsTooltip: true,
    size: "small",
    ...{ class: "type-select" },
    placeholder: "设备类型（不选=不限）",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
for (const [t] of __VLS_getVForSourceType((__VLS_ctx.deviceTypes))) {
    const __VLS_24 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        key: (t),
        label: (t),
        value: (t),
    }));
    const __VLS_26 = __VLS_25({
        key: (t),
        label: (t),
        value: (t),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
}
var __VLS_23;
const __VLS_28 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    modelValue: (__VLS_ctx.draft.device_ids),
    multiple: true,
    collapseTags: true,
    collapseTagsTooltip: true,
    size: "small",
    ...{ class: "device-select" },
    placeholder: "具体设备（不选=按类型/全部）",
}));
const __VLS_30 = __VLS_29({
    modelValue: (__VLS_ctx.draft.device_ids),
    multiple: true,
    collapseTags: true,
    collapseTagsTooltip: true,
    size: "small",
    ...{ class: "device-select" },
    placeholder: "具体设备（不选=按类型/全部）",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
for (const [t] of __VLS_getVForSourceType((__VLS_ctx.deviceTypes))) {
    const __VLS_32 = {}.ElOptionGroup;
    /** @type {[typeof __VLS_components.ElOptionGroup, typeof __VLS_components.elOptionGroup, typeof __VLS_components.ElOptionGroup, typeof __VLS_components.elOptionGroup, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        key: (t),
        label: (t),
    }));
    const __VLS_34 = __VLS_33({
        key: (t),
        label: (t),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_35.slots.default;
    for (const [d] of __VLS_getVForSourceType((__VLS_ctx.devicesByType[t]))) {
        const __VLS_36 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
            key: (d.id),
            label: (`${d.type} #${d.id}`),
            value: (d.id),
        }));
        const __VLS_38 = __VLS_37({
            key: (d.id),
            label: (`${d.type} #${d.id}`),
            value: (d.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    }
    var __VLS_35;
}
var __VLS_31;
const __VLS_40 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    ...{ 'onClick': {} },
    size: "small",
    text: true,
    type: "info",
}));
const __VLS_42 = __VLS_41({
    ...{ 'onClick': {} },
    size: "small",
    text: true,
    type: "info",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
let __VLS_44;
let __VLS_45;
let __VLS_46;
const __VLS_47 = {
    onClick: (__VLS_ctx.clearSelection)
};
__VLS_43.slots.default;
var __VLS_43;
if (__VLS_ctx.removable) {
    const __VLS_48 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        ...{ 'onClick': {} },
        size: "small",
        text: true,
        type: "danger",
    }));
    const __VLS_50 = __VLS_49({
        ...{ 'onClick': {} },
        size: "small",
        text: true,
        type: "danger",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    let __VLS_52;
    let __VLS_53;
    let __VLS_54;
    const __VLS_55 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.removable))
                return;
            __VLS_ctx.emit('remove');
        }
    };
    __VLS_51.slots.default;
    var __VLS_51;
}
/** @type {__VLS_StyleScopedClasses['group-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['name-input']} */ ;
/** @type {__VLS_StyleScopedClasses['presets']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['type-select']} */ ;
/** @type {__VLS_StyleScopedClasses['device-select']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            RANGE_PRESETS: RANGE_PRESETS,
            emit: emit,
            devicesByType: devicesByType,
            makeRange: makeRange,
            clearSelection: clearSelection,
            shortcuts: shortcuts,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
