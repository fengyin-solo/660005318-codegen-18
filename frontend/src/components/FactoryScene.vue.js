/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useFactoryStore } from '../store/factory';
import { STATUS_COLORS } from '../types';
const store = useFactoryStore();
const container = ref();
let scene, camera, renderer, controls, animId;
const deviceGroup = new THREE.Group();
const deviceMeshes = new Map();
function initScene() {
    const c = container.value;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1b2a);
    scene.fog = new THREE.Fog(0x0d1b2a, 10, 30);
    camera = new THREE.PerspectiveCamera(50, c.clientWidth / c.clientHeight, 0.1, 50);
    camera.position.set(6, 8, 10);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(c.clientWidth, c.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    c.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    scene.add(new THREE.AmbientLight(0x304060, 1.2));
    const dl = new THREE.DirectionalLight(0xffffff, 1.0);
    dl.position.set(5, 10, 5);
    dl.castShadow = true;
    dl.shadow.mapSize.set(512, 512);
    scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x6688cc, 0.3);
    dl2.position.set(-3, 5, -3);
    scene.add(dl2);
    // Floor
    const floorGeom = new THREE.PlaneGeometry(16, 16);
    const floorMat = new THREE.MeshPhongMaterial({ color: 0x1a2a3a, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    // Grid
    const grid = new THREE.GridHelper(16, 16, 0x1e3a5f, 0x0d1b2a);
    scene.add(grid);
    // Building walls
    const wallGeom = new THREE.BoxGeometry(12, 2, 0.1);
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.5 });
    for (const [x, z, ry] of [[0, 6, 0], [0, -6, 0], [6, 0, Math.PI / 2], [-6, 0, Math.PI / 2]]) {
        const wall = new THREE.Mesh(wallGeom, wallMat);
        wall.position.set(x, 1, z);
        wall.rotation.y = ry;
        scene.add(wall);
    }
    scene.add(deviceGroup);
}
function createDeviceMesh(dev) {
    const group = new THREE.Group();
    const [px, py, pz] = dev.position;
    group.position.set(px, py, pz);
    const color = STATUS_COLORS[dev.status] || '#95a5a6';
    // Base
    const baseGeom = new THREE.BoxGeometry(0.6, 0.2, 0.6);
    const base = new THREE.Mesh(baseGeom, new THREE.MeshPhongMaterial({ color: 0x334466 }));
    base.position.y = 0.1;
    group.add(base);
    // Body (varies by type)
    const bodyGeom = dev.type === 'RobotArm' ? new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8) :
        dev.type === 'Conveyor' ? new THREE.BoxGeometry(1.2, 0.3, 0.4) :
            dev.type === 'AGV' ? new THREE.BoxGeometry(0.5, 0.3, 0.7) : new THREE.BoxGeometry(0.5, 0.8, 0.5);
    const body = new THREE.Mesh(bodyGeom, new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3 }));
    body.position.y = dev.type === 'RobotArm' ? 0.8 : 0.5;
    group.add(body);
    // Indicator light
    const lightGeom = new THREE.SphereGeometry(0.08, 8, 8);
    const light = new THREE.Mesh(lightGeom, new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.8 }));
    light.position.y = 1.1;
    group.add(light);
    // Label using sprite
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${dev.type}-${dev.id}`, 64, 28);
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui';
    ctx.fillText(`${dev.temperature.toFixed(1)}°C | ${dev.status}`, 64, 48);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.position.y = 1.4;
    sprite.scale.set(1.5, 0.75, 1);
    group.add(sprite);
    return group;
}
function updateDevices() {
    const devs = store.data?.devices || [];
    for (const dev of devs) {
        let mesh = deviceMeshes.get(dev.id);
        if (!mesh) {
            mesh = createDeviceMesh(dev);
            deviceGroup.add(mesh);
            deviceMeshes.set(dev.id, mesh);
        }
        mesh.position.set(dev.position[0], dev.position[1], dev.position[2]);
        const body = mesh.children.find(c => c instanceof THREE.Mesh && c !== mesh.children[0]);
        if (body) {
            const color = STATUS_COLORS[dev.status] || '#95a5a6';
            if (body.material instanceof THREE.MeshPhongMaterial) {
                body.material.color.set(color);
                body.material.emissive.set(color);
            }
        }
    }
}
function animate() { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
onMounted(() => { initScene(); animate(); });
watch(() => store.data, updateDevices, { deep: true });
onUnmounted(() => { cancelAnimationFrame(animId); renderer?.dispose(); });
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "container",
    ...{ class: "viewer3d" },
});
/** @type {typeof __VLS_ctx.container} */ ;
/** @type {__VLS_StyleScopedClasses['viewer3d']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            container: container,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
