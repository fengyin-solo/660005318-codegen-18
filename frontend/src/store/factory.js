import { defineStore } from 'pinia';
import { ref } from 'vue';
export const useFactoryStore = defineStore('factory', () => {
    const data = ref(null);
    const ws = ref(null);
    const connected = ref(false);
    function connect() {
        if (ws.value)
            return;
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const s = new WebSocket(`${protocol}//${location.hostname}:8000/ws`);
        s.onopen = () => { connected.value = true; console.log('WS connected'); };
        s.onmessage = (e) => {
            try {
                data.value = JSON.parse(e.data);
            }
            catch { }
        };
        s.onclose = () => { connected.value = false; ws.value = null; };
        ws.value = s;
    }
    function disconnect() {
        ws.value?.close();
        ws.value = null;
        connected.value = false;
    }
    return { data, connected, connect, disconnect };
});
