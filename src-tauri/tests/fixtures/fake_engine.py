"""Scripted fake Rinari engine for hermetic desktop-client tests.

Speaks just enough of Engine Protocol v1 over stdio (hello, response
envelopes, async events) with canned answers: no model, no network, no
credentials, deterministic timing. Run by Rust integration tests in
src-tauri/tests/engine_roundtrip.rs — never by production code.

Usage:
    python fake_engine.py --scenario stream|slow|approval|die

Scenarios (all keyed off session.turn.start):
    stream    3 content deltas, then turn.completed.
    slow      200 deltas 50ms apart; honours session.turn.cancel.
    approval  1 delta, then approval.requested; waits for approval.resolve
              (or EOF) before approval.resolved + turn.completed.
    die       turn.started + 1 delta, then exits abruptly (crash path).
"""

import json
import os
import sys
import threading
import time

CAPABILITIES = {
    "chat": True,
    "projects": True,
    "browser": True,
    "mcp": True,
    "plugins": True,
    "subagents": True,
    "artifacts": True,
    "checkpoints": True,
    "terminal": True,
}

DECISIONS = ["allow_once", "allow_session", "deny"]


def emit(name, payload):
    sys.stdout.write(json.dumps({"type": "event", "event": name, "payload": payload}) + "\n")
    sys.stdout.flush()


def respond(req_id, ok=True, result=None, error=None):
    message = {"id": req_id, "ok": ok}
    if ok:
        message["result"] = result if result is not None else {}
    else:
        message["error"] = error
    sys.stdout.write(json.dumps(message) + "\n")
    sys.stdout.flush()


def fail(req_id, code, message):
    respond(req_id, ok=False, error={"code": code, "message": message,
                                    "retryable": False, "details": {}})


class FakeEngine:
    def __init__(self, scenario):
        self.scenario = scenario
        self.lock = threading.Lock()
        self.sessions = {}
        self.session_seq = 0
        self.turn_seq = 0
        self.cancelled = set()
        self.approved = {}

    def session_list(self, req_id, _params):
        respond(req_id, result={"sessions": list(self.sessions.values())})

    def session_create(self, req_id, params):
        params = params or {}
        self.session_seq += 1
        session_id = f"ses_fake{self.session_seq}"
        record = {"session_id": session_id,
                  "title": params.get("title", "fake"),
                  "chat": params.get("chat", True)}
        self.sessions[session_id] = record
        respond(req_id, result={"session_id": session_id, "created": True,
                               "session": record})

    def turn_start(self, req_id, params):
        session_id = (params or {}).get("session_id", "")
        if session_id not in self.sessions:
            fail(req_id, "NOT_FOUND", f"Session {session_id} not found.")
            return
        self.turn_seq += 1
        turn_id = f"turn_fake{self.turn_seq}"
        respond(req_id, result={"status": "started", "turn_id": turn_id,
                               "session_id": session_id})
        worker = threading.Thread(target=self._run_scenario,
                                  args=(turn_id, session_id), daemon=True)
        worker.start()

    def turn_cancel(self, req_id, params):
        session_id = (params or {}).get("session_id", "")
        with self.lock:
            self.cancelled.add(session_id)
        respond(req_id, result={"status": "cancelled", "session_id": session_id})

    def approval_resolve(self, req_id, params):
        params = params or {}
        approval_id = params.get("approval_id", "")
        decision = params.get("decision", "")
        if decision not in DECISIONS:
            fail(req_id, "INVALID_PARAMS",
                 f"Param 'decision' must be one of {', '.join(DECISIONS)}.")
            return
        with self.lock:
            event = self.approved.setdefault(approval_id, threading.Event())
            self.approved[approval_id + ":decision"] = decision
            event.set()
        respond(req_id, result={"status": "resolved", "approval_id": approval_id,
                               "decision": decision})

    def snapshot_get(self, req_id, _params):
        respond(req_id, result={"sessions": list(self.sessions.values()),
                               "engine": {"version": "fake-1.0"}})

    def engine_info(self, req_id, _params):
        respond(req_id, result={"protocol": "rinari-engine", "protocol_version": 1,
                               "engine_version": "fake-1.0",
                               "capabilities": CAPABILITIES})

    def provider_list(self, req_id, _params):
        respond(req_id, result={"providers": [{"alias": "fake", "kind": "fake"}],
                               "active_alias": "fake"})

    def model_list(self, req_id, _params):
        respond(req_id, result={"models": [{"alias": "fake-one",
                                           "provider": "fake"}]})

    def _run_scenario(self, turn_id, session_id):
        scenario = self.scenario
        emit("turn.started", {"turn_id": turn_id, "session_id": session_id})
        if scenario == "die":
            emit("model.content.delta", {"turn_id": turn_id,
                                         "session_id": session_id,
                                         "delta": "bye"})
            sys.stdout.flush()
            os._exit(1)
        if scenario == "approval":
            self._run_approval(turn_id, session_id)
            return
        deltas = (["Hola, ", "soy ", "Rinari."]
                  if scenario == "stream" else [f"tick{i} " for i in range(200)])
        pace = 0.01 if scenario == "stream" else 0.05
        for delta in deltas:
            with self.lock:
                stop = session_id in self.cancelled
            if stop:
                break
            emit("model.content.delta", {"turn_id": turn_id,
                                         "session_id": session_id,
                                         "delta": delta})
            time.sleep(pace)
        with self.lock:
            was_cancelled = session_id in self.cancelled
            self.cancelled.discard(session_id)
        if was_cancelled:
            emit("turn.cancelled", {"turn_id": turn_id, "session_id": session_id})
        else:
            emit("turn.completed", {"turn_id": turn_id, "session_id": session_id,
                                   "kind": "done", "content": "".join(deltas)})

    def _run_approval(self, turn_id, session_id):
        emit("model.content.delta", {"turn_id": turn_id, "session_id": session_id,
                                     "delta": "necesito permiso"})
        approval_id = "apr_fake1"
        with self.lock:
            event = self.approved.setdefault(approval_id, threading.Event())
        emit("approval.requested", {
            "approval_id": approval_id, "session_id": session_id,
            "turn_id": turn_id, "tool": "shell.exec",
            "capability": "shell.exec", "target": "echo hi", "risk": "low",
            "description": "fake approval", "choices": DECISIONS})
        decided = event.wait(timeout=30.0)
        with self.lock:
            decision = self.approved.get(approval_id + ":decision", "deny")
        if not decided:
            emit("approval.expired", {"approval_id": approval_id,
                                      "session_id": session_id})
            emit("turn.completed", {"turn_id": turn_id, "session_id": session_id,
                                   "kind": "done", "content": "denied by timeout"})
            return
        emit("approval.resolved", {"approval_id": approval_id,
                                   "session_id": session_id, "decision": decision})
        emit("turn.completed", {"turn_id": turn_id, "session_id": session_id,
                               "kind": "done", "content": f"went ahead ({decision})"})

    def dispatch(self, message):
        req_id = message.get("id")
        method = message.get("method", "")
        params = message.get("params") or {}
        handler = {
            "engine.info": self.engine_info,
            "session.list": self.session_list,
            "session.create": self.session_create,
            "session.turn.start": self.turn_start,
            "session.turn.cancel": self.turn_cancel,
            "approval.resolve": self.approval_resolve,
            "runtime.snapshot.get": self.snapshot_get,
            "provider.list": self.provider_list,
            "model.list": self.model_list,
        }.get(method)
        if handler is None:
            fail(req_id, "UNKNOWN_METHOD", f"Unknown method: {method}.")
            return
        handler(req_id, params)


def main(argv):
    scenario = "stream"
    for arg in argv[1:]:
        if arg.startswith("--scenario="):
            scenario = arg.split("=", 1)[1]
    if scenario not in ("stream", "slow", "approval", "die"):
        raise SystemExit(f"unknown scenario: {scenario}")
    sys.stdout.write(json.dumps({
        "type": "hello", "protocol": "rinari-engine", "protocol_version": 1,
        "engine_version": "fake-1.0", "capabilities": CAPABILITIES}) + "\n")
    sys.stdout.flush()
    engine = FakeEngine(scenario)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            continue
        engine.dispatch(message)


if __name__ == "__main__":
    main(sys.argv)
