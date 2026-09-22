import asyncio, math, random, time, json, threading
from collections import defaultdict, deque
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

app = FastAPI(title="Digital Twin Factory Monitor")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DEVICE_TYPES = ["CNC", "RobotArm", "Conveyor", "AGV", "InjectionMolding", "QCStation"]
STATUSES = ["RUNNING", "IDLE", "FAULT", "OFFLINE"]
ACTIVE_CLIENTS: list[WebSocket] = []
SIMULATOR_RUNNING = True

class DeviceState:
    def __init__(self, did: int, dtype: str, x: float, y: float, z: float):
        self.id = did
        self.type = dtype
        self.status = "RUNNING"
        self.position = [x, y, z]
        self.temperature = random.uniform(35, 45)
        self.vibration = random.uniform(0.1, 1.5)
        self.pressure = random.uniform(0.8, 1.2)
        self.production_count = 0
        self.fault_count = 0
        self.uptime = 0.0
        self.cycle_time = random.uniform(2, 8)
        self.quality_rate = random.uniform(0.95, 0.995)

    def to_dict(self):
        return {
            "id": self.id, "type": self.type, "status": self.status,
            "position": self.position, "temperature": round(self.temperature, 2),
            "vibration": round(self.vibration, 3), "pressure": round(self.pressure, 2),
            "production_count": self.production_count, "fault_count": self.fault_count,
            "uptime": round(self.uptime, 2), "quality_rate": round(self.quality_rate, 3)
        }

devices = {i: DeviceState(i, random.choice(DEVICE_TYPES),
                          random.uniform(-5, 5), 0.5, random.uniform(-5, 5)) for i in range(1, 13)}

production_log = []
anomaly_log = []
# 逐秒采样历史：每台设备的产量/故障计数快照，供时间范围批量对比使用
sample_log = deque(maxlen=7200)

class AnomalyRules:
    def __init__(self):
        self.rules = [
            {"name": "高温告警", "field": "temperature", "threshold": 48, "op": "gt"},
            {"name": "振动超标", "field": "vibration", "threshold": 2.0, "op": "gt"},
            {"name": "压力异常", "field": "pressure", "threshold": 1.5, "op": "gt"},
        ]
        self.windows = defaultdict(lambda: deque(maxlen=10))

    def check(self, dev: DeviceState):
        triggers = []
        for rule in self.rules:
            val = getattr(dev, rule["field"])
            if (rule["op"] == "gt" and val > rule["threshold"]) or (rule["op"] == "lt" and val < rule["threshold"]):
                triggers.append({"device_id": dev.id, "rule": rule["name"],
                                 "value": round(val, 3), "threshold": rule["threshold"]})

        # sliding window trend
        key = f"{dev.id}_temp"
        self.windows[key].append(dev.temperature)
        if len(self.windows[key]) >= 8:
            vals = list(self.windows[key])
            if np.mean(vals[-4:]) - np.mean(vals[:4]) > 3:
                triggers.append({"device_id": dev.id, "rule": "温度趋势上升", "value": round(np.mean(vals[-4:]), 2), "threshold": ">3°C/周期"})

        if triggers:
            anomaly_log.append({"timestamp": time.time(), "triggers": triggers, "device_type": dev.type})
        return triggers

rules_engine = AnomalyRules()

def simulate():
    while SIMULATOR_RUNNING:
        for dev in devices.values():
            drift = 0.1 * math.sin(time.time() * 0.5 + dev.id)
            noise = random.gauss(0, 0.3)
            dev.temperature = max(25, min(65, dev.temperature + drift + noise))

            v_drift = 0.02 * math.sin(time.time() * 0.3 + dev.id * 0.7)
            dev.vibration = max(0, min(3, dev.vibration + v_drift + random.gauss(0, 0.05)))

            dev.pressure = max(0.5, min(2, dev.pressure + random.gauss(0, 0.02)))

            if random.random() < 0.015:
                dev.status = "FAULT"
                dev.fault_count += 1
            elif random.random() < 0.03 and dev.status == "FAULT":
                dev.status = "RUNNING"

            if dev.status == "RUNNING":
                if random.random() < 0.4:
                    dev.production_count += 1
                dev.uptime += 1

            triggers = rules_engine.check(dev)
            if triggers and dev.status != "FAULT" and random.random() < 0.3:
                dev.status = "FAULT"

        production_log.append({"timestamp": time.time(), "count": sum(d.production_count for d in devices.values())})
        sample_log.append({"ts": time.time(),
                           "dev": {i: {"p": d.production_count, "f": d.fault_count}
                                   for i, d in devices.items()}})

        try:
            payload = {
                "devices": [d.to_dict() for d in devices.values()],
                "production": sum(d.production_count for d in devices.values()),
                "anomalies": anomaly_log[-5:] if anomaly_log else [],
                "oee": calculate_oee()
            }
            msg = json.dumps(payload)
        except:
            continue

        dead = []
        for ws in ACTIVE_CLIENTS:
            try:
                asyncio.run_coroutine_threadsafe(ws.send_text(msg), asyncio.get_event_loop())
            except:
                dead.append(ws)
        for ws in dead:
            if ws in ACTIVE_CLIENTS:
                ACTIVE_CLIENTS.remove(ws)

        time.sleep(1)


def calculate_oee():
    oee_list = []
    for dev in devices.values():
        if dev.uptime == 0:
            continue
        availability = min(1.0, dev.uptime / max(1, dev.uptime + dev.fault_count))
        performance = min(1.0, dev.production_count / max(1, dev.uptime / 2))
        quality = dev.quality_rate
        oee = round(availability * performance * quality * 100, 1)
        oee_list.append({"id": dev.id, "type": dev.type, "oee": oee,
                         "availability": round(availability * 100, 1),
                         "performance": round(performance * 100, 1),
                         "quality": round(quality * 100, 1)})
    return oee_list


class OEEAnalysis(BaseModel):
    availability: float
    performance: float
    quality: float


@app.on_event("startup")
async def startup():
    t = threading.Thread(target=simulate, daemon=True)
    t.start()


@app.get("/api/devices")
def get_devices():
    return {"devices": [d.to_dict() for d in devices.values()], "anomalies": anomaly_log[-10:]}


@app.get("/api/oee")
def get_oee():
    return {"oee": calculate_oee()}


@app.get("/api/production")
def get_production():
    return {"log": production_log[-60:]}


class CompareGroup(BaseModel):
    name: str = ""
    start: float
    end: float
    device_ids: list[int] = []  # 空列表表示全部设备

class CompareRequest(BaseModel):
    groups: list[CompareGroup]
    baseline: int = 0  # 基准组在 groups 中的下标


def _group_stats(g: CompareGroup, samples: list):
    """计算单组统计口径与指标，返回 (stats, error_reason)"""
    ids = [i for i in (g.device_ids or list(devices.keys())) if i in devices]
    if not ids:
        return None, "无有效设备"
    if g.end <= g.start:
        return None, "时间范围无效(结束时间需晚于开始时间)"
    in_range = [s for s in samples if g.start <= s["ts"] <= g.end]
    if not in_range:
        return None, "该范围无采样数据"
    # 基准快照取 start 之前最后一个采样，使相邻范围的事件不重复也不遗漏；
    # 若 start 之前无采样（日志起点），退化为范围内第一个采样
    before = None
    for s in samples:
        if s["ts"] < g.start:
            before = s
        else:
            break
    start_snap = before if before else in_range[0]
    end_snap = in_range[-1]
    production = sum(end_snap["dev"][i]["p"] - start_snap["dev"][i]["p"] for i in ids)
    faults = sum(end_snap["dev"][i]["f"] - start_snap["dev"][i]["f"] for i in ids)
    return {
        "production": production, "faults": faults,
        "device_ids": ids, "device_count": len(ids),
        "sample_count": len(in_range),
        "actual_start": in_range[0]["ts"], "actual_end": in_range[-1]["ts"],
        "duration": round(in_range[-1]["ts"] - in_range[0]["ts"], 1),
    }, None


@app.post("/api/production/compare")
def compare_production(req: CompareRequest):
    """批量对比：多组时间范围/设备组合一次算出产量与故障，跳过无数据或重叠的组，不中断整批"""
    samples = list(sample_log)
    groups = req.groups[:20]
    names = [(g.name.strip() or f"组{i+1}") for i, g in enumerate(groups)]

    # 重叠检测：时间区间相交的组互相标记
    overlap_with = defaultdict(list)
    for i in range(len(groups)):
        for j in range(i + 1, len(groups)):
            a, b = groups[i], groups[j]
            if a.start < b.end and b.start < a.end:
                overlap_with[i].append(j)
                overlap_with[j].append(i)

    results, skipped = [], []
    for idx, g in enumerate(groups):
        try:
            if idx in overlap_with:
                others = "、".join(f"「{names[j]}」" for j in overlap_with[idx])
                skipped.append({"name": names[idx], "reason": f"与{others}时间范围重叠"})
                continue
            stats, err = _group_stats(g, samples)
            if err:
                skipped.append({"name": names[idx], "reason": err})
                continue
            stats["name"] = names[idx]
            stats["index"] = idx
            results.append(stats)
        except Exception as e:
            skipped.append({"name": names[idx], "reason": f"计算失败: {e}"})

    base = None
    if results:
        base = next((r for r in results if r["index"] == req.baseline), results[0])
        for r in results:
            r["production_diff"] = r["production"] - base["production"]
            r["production_diff_pct"] = (round((r["production"] - base["production"]) / base["production"] * 100, 1)
                                        if base["production"] else None)
            r["fault_diff"] = r["faults"] - base["faults"]
    return {"baseline": base["name"] if base else None, "results": results, "skipped": skipped}


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    ACTIVE_CLIENTS.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in ACTIVE_CLIENTS:
            ACTIVE_CLIENTS.remove(websocket)


@app.on_event("shutdown")
async def shutdown():
    global SIMULATOR_RUNNING
    SIMULATOR_RUNNING = False