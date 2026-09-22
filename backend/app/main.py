from __future__ import annotations
import asyncio, bisect, math, random, time, json, threading
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
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

# ---- 产量批量对比：设备级历史快照（每个 tick 每台设备一条）----
# {device_id: [{"timestamp", "production", "faults", "running", "quality"}, ...]}
device_history: Dict[int, deque] = defaultdict(lambda: deque(maxlen=1800))
HISTORY_RETENTION = 1800  # 约 30 分钟采样窗口
MAX_COMPARE_GROUPS = 10


def _r3(v: float) -> float:
    return round(float(v), 3)

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
        tick_ts = time.time()
        for dev in devices.values():
            drift = 0.1 * math.sin(tick_ts * 0.5 + dev.id)
            noise = random.gauss(0, 0.3)
            dev.temperature = max(25, min(65, dev.temperature + drift + noise))

            v_drift = 0.02 * math.sin(tick_ts * 0.3 + dev.id * 0.7)
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

            # 记录设备级快照，供批量对比统计使用
            device_history[dev.id].append({
                "timestamp": tick_ts,
                "production": dev.production_count,
                "faults": dev.fault_count,
                "running": 1 if dev.status == "RUNNING" else 0,
                "quality": dev.quality_rate,
            })

        production_log.append({"timestamp": tick_ts, "count": sum(d.production_count for d in devices.values())})

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


# ---- 产量批量对比 ----
class CompareGroupIn(BaseModel):
    name: Optional[str] = None
    start: float
    end: float
    device_ids: Optional[List[int]] = None
    device_types: Optional[List[str]] = None


class CompareRequest(BaseModel):
    groups: List[CompareGroupIn]
    baseline_index: int = 0


def _resolve_group_devices(group: CompareGroupIn) -> Tuple[Set[int], List[int]]:
    """解析一组选中的设备；返回 (设备集合, 无法识别的设备ID)。"""
    wanted_ids: Set[int] = set(group.device_ids or [])
    wanted_types: Set[str] = set(group.device_types or [])

    unknown = sorted(i for i in wanted_ids if i not in devices)
    known_ids = wanted_ids & set(devices.keys())

    if not wanted_ids and not wanted_types:
        return set(devices.keys()), []

    selected = set(known_ids)
    for dev in devices.values():
        if dev.type in wanted_types:
            selected.add(dev.id)
    return selected, unknown


def _ranges_overlap(s1: float, e1: float, s2: float, e2: float) -> bool:
    return s1 < e2 and s2 < e1


def _compute_series(start: float, end: float, dev_ids: Set[int]) -> Optional[Dict[str, Any]]:
    """在 [start, end) 内对选定设备聚合产量/故障/运行/质量统计；无采样数据返回 None。"""
    total_production = 0
    total_faults = 0
    running_samples = 0
    total_samples = 0
    quality_sum = 0.0
    quality_n = 0
    timestamps: Set[float] = set()

    for did in dev_ids:
        rows = device_history.get(did)
        if not rows:
            continue
        # deque 已按时间升序；用二分定位区间边界
        ts_list = [r["timestamp"] for r in rows]
        lo = bisect.bisect_left(ts_list, start)
        hi = bisect.bisect_left(ts_list, end)
        inside = [rows[k] for k in range(lo, hi)]
        if not inside:
            continue
        timestamps.update(r["timestamp"] for r in inside)

        if lo > 0:
            base = rows[lo - 1]
            production = inside[-1]["production"] - base["production"]
            faults = inside[-1]["faults"] - base["faults"]
        else:
            # 无基线时退化为区间内增量之和
            production = sum(
                max(0, inside[i]["production"] - inside[i - 1]["production"])
                for i in range(1, len(inside))
            )
            faults = sum(
                max(0, inside[i]["faults"] - inside[i - 1]["faults"])
                for i in range(1, len(inside))
            )

        total_production += max(0, production)
        total_faults += max(0, faults)
        running_samples += sum(r["running"] for r in inside)
        total_samples += len(inside)
        quality_sum += sum(r["quality"] for r in inside)
        quality_n += len(inside)

    if not timestamps:
        return None

    span_minutes = (end - start) / 60.0
    device_count = len(dev_ids)
    point_count = len(timestamps)
    avg_quality = quality_sum / quality_n if quality_n else 0.0
    return {
        "production": total_production,
        "faults": total_faults,
        "faults_per_1000": _r3(total_faults / total_production * 1000) if total_production else None,
        "production_per_hour": _r3(total_production / span_minutes * 60) if span_minutes > 0 else None,
        "running_ratio": _r3(running_samples / total_samples) if total_samples else None,
        "avg_quality": _r3(avg_quality),
        "caliber": {
            "sample_points": point_count,
            "total_samples": total_samples,
            "device_count": device_count,
            "span_minutes": _r3(span_minutes),
            "window": "累计增量（区间末快照 - 区间前基线快照，按设备求和）",
        },
    }


@app.post("/api/production/compare")
def post_production_compare(req: CompareRequest):
    if not req.groups:
        raise HTTPException(status_code=400, detail="至少需要一个对比组")
    if len(req.groups) > MAX_COMPARE_GROUPS:
        raise HTTPException(status_code=400, detail=f"对比组最多 {MAX_COMPARE_GROUPS} 个")

    now = time.time()
    n = len(req.groups)

    # 1) 逐组解析设备与时间区间，单组失败不影响其它组
    resolved: List[Optional[Set[int]]] = [None] * n
    unknown_ids: List[List[int]] = [[] for _ in range(n)]
    labels: List[str] = []
    for i, g in enumerate(req.groups):
        label = g.name or f"组{i + 1}"
        labels.append(label)
        if g.end <= g.start:
            continue
        resolved[i], unknown_ids[i] = _resolve_group_devices(g)

    # 2) 检查区间重叠：时间重叠且设备集合有交集才算冲突
    overlap_with: List[List[str]] = [[] for _ in range(n)]
    for i in range(n):
        if resolved[i] is None:
            continue
        for j in range(i + 1, n):
            if resolved[j] is None:
                continue
            gi, gj = req.groups[i], req.groups[j]
            if (_ranges_overlap(gi.start, gi.end, gj.start, gj.end)
                    and resolved[i] & resolved[j]):
                overlap_with[i].append(labels[j])
                overlap_with[j].append(labels[i])

    # 3) 逐组计算；重叠 / 无采样 / 参数非法的组标记并跳过，不中断整批
    results: List[Dict[str, Any]] = []
    for i, g in enumerate(req.groups):
        entry: Dict[str, Any] = {
            "index": i,
            "name": labels[i],
            "start": g.start,
            "end": g.end,
            "device_ids": sorted(resolved[i]) if resolved[i] is not None else [],
            "device_types": g.device_types or [],
            "status": "ok",
            "skip_reason": None,
            "overlap_with": overlap_with[i],
            "unknown_device_ids": unknown_ids[i],
            "metrics": None,
        }
        if g.end <= g.start:
            entry["status"] = "skipped"
            entry["skip_reason"] = "时间范围无效：结束时间必须晚于开始时间"
        elif overlap_with[i]:
            entry["status"] = "skipped"
            entry["skip_reason"] = "与其它组时间范围重叠且设备组合有交集，已跳过"
        elif not resolved[i]:
            entry["status"] = "skipped"
            entry["skip_reason"] = "未匹配到任何有效设备"
        else:
            eff_end = min(g.end, now)
            metrics = _compute_series(g.start, eff_end, resolved[i])
            if metrics is None:
                entry["status"] = "skipped"
                entry["skip_reason"] = "该时间范围内没有任何采样数据"
            else:
                if eff_end < g.end:
                    entry["truncated_to"] = eff_end
                entry["metrics"] = metrics
        results.append(entry)

    # 4) 基准组：指定的基准被跳过时自动回退到第一个有效组
    valid_indices = [r["index"] for r in results if r["status"] == "ok"]
    baseline_index = req.baseline_index if req.baseline_index in valid_indices else (
        valid_indices[0] if valid_indices else -1)

    baseline_metrics = results[baseline_index]["metrics"] if baseline_index >= 0 else None
    for r in results:
        if r["status"] != "ok":
            r["diff"] = None
            continue
        m = r["metrics"]
        diff: Dict[str, Any] = {}
        if baseline_metrics is None or r["index"] == baseline_index:
            diff = {k: 0.0 if isinstance(v, (int, float)) else None
                    for k, v in m.items() if k != "caliber"}
        else:
            for k, v in m.items():
                if k == "caliber":
                    continue
                bv = baseline_metrics.get(k)
                diff[k] = _r3(v - bv) if isinstance(v, (int, float)) and isinstance(bv, (int, float)) else None
        r["diff"] = diff

    return {
        "server_time": now,
        "baseline_index": baseline_index,
        "baseline_requested": req.baseline_index,
        "baseline_fallback": baseline_index != req.baseline_index,
        "groups": results,
    }


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