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
        self.providers = {}
        self.provider_seq = 0
        self.active_provider = None
        self.models = []
        self.model_seq = 0
        self.transcripts = {}
        self.pending_turns = {}
        self.agent_configs = {}

    def session_list(self, req_id, _params):
        respond(req_id, result={"sessions": list(self.sessions.values())})

    def session_create(self, req_id, params):
        params = params or {}
        self.session_seq += 1
        session_id = f"ses_fake{self.session_seq}"
        kind = "PROJECT" if not params.get("chat", True) else "CHAT"
        record = {"id": session_id,
                  "kind": kind,
                  "title": params.get("title") or "fake",
                  "mode": "build",
                  "state": "active",
                  "project_root": None,
                  "current_cwd": "/fake/work",
                  "updated_at": "2026-01-01T00:00:00Z"}
        self.sessions[session_id] = record
        self.transcripts[session_id] = []
        respond(req_id, result={"session_id": session_id, "created": True,
                               "session": record})

    def session_open(self, req_id, params):
        session_id = (params or {}).get("ref", "")
        record = self.sessions.get(session_id)
        if record is None:
            fail(req_id, "NOT_FOUND", f"Session {session_id} not found.")
            return
        respond(req_id, result={"session": record, "created": False, "warnings": []})

    def session_mode_set(self, req_id, params):
        params = params or {}
        session_id = params.get("ref", "")
        record = self.sessions.get(session_id)
        if record is None:
            fail(req_id, "NOT_FOUND", f"Session {session_id} not found.")
            return
        mode = params.get("mode", "")
        if mode not in ("plan", "build", "review"):
            fail(req_id, "INVALID_USAGE",
                 f"Unknown session mode: {mode!r}. Valid modes: plan, build, review.")
            return
        record["mode"] = mode
        respond(req_id, result={"session": record})
        emit("session.mode.changed", {"session_id": session_id, "mode": mode})

    # -- workspace reads (Phase 6): canned, path-echoing shapes -------------

    def task_tree(self, req_id, params):
        if not (params or {}).get("path"):
            fail(req_id, "INVALID_PARAMS", "Param 'path' must be a non-empty string.")
            return
        tasks = [{"id": "tsk_fake1", "title": "Fake task",
                  "status": "in_progress", "depends_on": ""},
                 {"id": "tsk_fake2", "title": "Fake child",
                  "status": "pending", "depends_on": "tsk_fake1"}]
        respond(req_id, result={"tasks": tasks,
                               "depths": {"tsk_fake1": 0, "tsk_fake2": 1}})

    def task_get(self, req_id, params):
        params = params or {}
        if not params.get("path"):
            fail(req_id, "INVALID_PARAMS", "Param 'path' must be a non-empty string.")
            return
        if params.get("task_id") != "tsk_fake1":
            fail(req_id, "NOT_FOUND", "Task not found: %s." % params.get("task_id"))
            return
        respond(req_id, result={"task": {"id": "tsk_fake1", "title": "Fake task",
                                        "status": "in_progress",
                                        "done_when": {"done": False,
                                                     "blockers": ["tsk_fake2"]}}})

    def verification_latest(self, req_id, params):
        if not (params or {}).get("path"):
            fail(req_id, "INVALID_PARAMS", "Param 'path' must be a non-empty string.")
            return
        respond(req_id, result={"records": [
            {"id": "val_fake1", "kind": "test", "command": "pytest -q",
             "result": "pass", "summary": "3 passed",
             "created_at": "2026-01-01T00:00:00Z"}]})

    def verification_plan(self, req_id, params):
        params = params or {}
        if not params.get("path"):
            fail(req_id, "INVALID_PARAMS", "Param 'path' must be a non-empty string.")
            return
        changed = params.get("changed_files", [])
        if not isinstance(changed, list):
            fail(req_id, "INVALID_PARAMS", "Param 'changed_files' must be a list of strings.")
            return
        respond(req_id, result={"plan": {"changed": changed, "tests": ["pytest -q"],
                                        "targeted": [], "adjacent": [], "broader": [],
                                        "test_commands": ["pytest -q"], "lint_commands": [],
                                        "typecheck_commands": [], "build_commands": [],
                                        "sources": ["fake"], "risk": "low", "reasons": []}})

    def checkpoint_list(self, req_id, _params):
        respond(req_id, result={"checkpoints": [
            {"id": "chk_fake1", "label": "fake point",
             "created_at": "2026-01-01T00:00:00Z"}]})

    def checkpoint_show(self, req_id, params):
        if (params or {}).get("checkpoint_id") != "chk_fake1":
            fail(req_id, "INVALID_USAGE", "Checkpoint not found: %s."
                 % (params or {}).get("checkpoint_id"))
            return
        respond(req_id, result={"checkpoint": {"id": "chk_fake1", "label": "fake point",
                                              "files": [{"path": "a.txt",
                                                        "status": "modified"}]}})

    def checkpoint_restore(self, req_id, params):
        params = params or {}
        if not params.get("path"):
            fail(req_id, "INVALID_PARAMS", "Param 'path' must be a non-empty string.")
            return
        respond(req_id, result={"result": {"restored": ["a.txt"],
                                          "preview": bool(params.get("preview"))}})

    def project_changes(self, req_id, params):
        if not (params or {}).get("path"):
            fail(req_id, "INVALID_PARAMS", "Param 'path' must be a non-empty string.")
            return
        respond(req_id, result={"available": True, "branch": "main", "head": "abc123",
                               "dirty": True,
                               "files": [{"path": "a.txt", "staged": None,
                                         "unstaged": "M"}]})

    def project_diff(self, req_id, params):
        params = params or {}
        if not params.get("path"):
            fail(req_id, "INVALID_PARAMS", "Param 'path' must be a non-empty string.")
            return
        diff = "diff --git a/a.txt b/a.txt\n+fake line\n"
        respond(req_id, result={"diff": diff, "truncated": False, "binary": False,
                               "chars": len(diff)})

    # -- agents (Phase 7): canned registry + assignments ---------------------

    def agent_list(self, req_id, _params):
        agents = []
        for name in ("explore", "reviewer", "debugger", "researcher",
                     "implementer", "verifier"):
            saved = self.agent_configs.get(name, {})
            agents.append({"name": name, "description": f"fake {name}",
                          "profile": "read-only", "provenance": "builtin",
                          "tool_allowlist": [],
                          "budget": {"max_model_calls": 12, "max_tool_calls": 48,
                                    "max_wall_time_s": 600.0},
                          "assignment": {"model": saved.get("model"),
                                        "fallback": saved.get("fallback"),
                                        "enabled": saved.get("enabled", True)}})
        respond(req_id, result={"agents": agents})

    def agent_config_get(self, req_id, params):
        name = (params or {}).get("agent", "")
        if name not in ("explore", "reviewer", "debugger", "researcher",
                        "implementer", "verifier"):
            fail(req_id, "NOT_FOUND", f"Unknown agent: {name}.")
            return
        saved = self.agent_configs.get(name, {})
        respond(req_id, result={"agent": {"name": name, "description": f"fake {name}",
                                         "profile": "read-only", "provenance": "builtin",
                                         "tool_allowlist": [],
                                         "budget": {"max_model_calls": 12,
                                                   "max_tool_calls": 48,
                                                   "max_wall_time_s": 600.0},
                                         "assignment": {"model": saved.get("model"),
                                                       "fallback": saved.get("fallback"),
                                                       "enabled": saved.get("enabled", True)}}})

    def agent_config_set(self, req_id, params):
        params = params or {}
        name = params.get("agent", "")
        if name not in ("explore", "reviewer", "debugger", "researcher",
                        "implementer", "verifier"):
            fail(req_id, "NOT_FOUND", f"Unknown agent: {name}.")
            return
        if params.get("clear") is True:
            self.agent_configs.pop(name, None)
        else:
            saved = self.agent_configs.setdefault(name, {})
            if params.get("model") is not None:
                saved["model"] = params.get("model")
            if params.get("fallback") is not None:
                saved["fallback"] = params.get("fallback")
            if params.get("enabled") is not None:
                saved["enabled"] = params.get("enabled")
        self.agent_config_get(req_id, {"agent": name})

    def session_events(self, req_id, params):
        params = params or {}
        session_id = params.get("ref", "")
        if session_id not in self.sessions:
            fail(req_id, "NOT_FOUND", f"Session {session_id} not found.")
            return
        events = [{"id": "evt_fake1", "seq": 1, "type": "SubagentStart",
                  "payload": {"agent": "explore", "state": "running"},
                  "created_at": "2026-01-01T00:00:00Z"}]
        respond(req_id, result={"session_id": session_id, "events": events,
                               "has_more": False})

    def session_history(self, req_id, params):
        params = params or {}
        session_id = params.get("ref", "")
        rows = self.transcripts.get(session_id)
        if rows is None:
            fail(req_id, "NOT_FOUND", f"Session {session_id} not found.")
            return
        limit = params.get("limit", 200)
        if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 500:
            fail(req_id, "INVALID_PARAMS", "Param 'limit' must be an int in 1..500.")
            return
        window = rows[-limit:] if len(rows) > limit else rows
        respond(req_id, result={"session_id": session_id, "messages": window,
                               "total": len(rows), "has_more": len(rows) > len(window)})

    def _append_transcript(self, session_id, role, content):
        rows = self.transcripts.setdefault(session_id, [])
        rows.append({"id": f"msg_fake{len(rows) + 1}", "seq": len(rows) + 1,
                    "role": role, "content": content, "tool_calls": None,
                    "tool_call_id": None, "name": None,
                    "created_at": "2026-01-01T00:00:00Z"})

    def turn_start(self, req_id, params):
        params = params or {}
        session_id = params.get("session_id", "")
        if session_id not in self.sessions:
            fail(req_id, "NOT_FOUND", f"Session {session_id} not found.")
            return
        self.turn_seq += 1
        turn_id = f"turn_fake{self.turn_seq}"
        with self.lock:
            self.pending_turns[turn_id] = (session_id, params.get("message", ""))
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
        with self.lock:
            pending = self.pending_turns.pop(turn_id, None)
        if pending is not None and scenario in ("stream", "slow"):
            session_id, message = pending
            if scenario == "stream" or not was_cancelled:
                self._append_transcript(session_id, "user", message)
                self._append_transcript(session_id, "assistant", "".join(deltas))

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

    def _provider_view(self, record):
        view = dict(record)
        view["active"] = record["alias"] == self.active_provider
        return view

    def _model_view(self, model):
        view = dict(model)
        view["provider"] = self.providers.get(model["provider_id"], {}).get("alias")
        return view

    def _active_model_id(self):
        for model in self.models:
            if model.get("active"):
                return model["id"]
        return None

    def provider_list(self, req_id, _params):
        respond(req_id, result={
            "providers": [self._provider_view(r) for r in self.providers.values()],
            "active_alias": self.active_provider,
        })

    def provider_create(self, req_id, params):
        params = params or {}
        alias = params.get("alias") or ""
        provider_type = params.get("type") or ""
        if not alias or not provider_type:
            fail(req_id, "INVALID_PARAMS", "Param 'alias'/'type' must be non-empty.")
            return
        if alias in self.providers:
            fail(req_id, "CONFLICT", f"Provider alias already exists: {alias}.")
            return
        self.provider_seq += 1
        record = {
            "id": f"prov_fake{self.provider_seq}",
            "alias": alias,
            "type": provider_type,
            "auth_method": params.get("auth_method") or "api-key",
            "account_hint": params.get("account_hint"),
            "endpoint": params.get("endpoint"),
            "settings": params.get("settings") or {},
            "status_connected": None,
            "status_checked_at": None,
            "default_model_id": None,
            "last_used_model_id": None,
            "has_credential": bool(params.get("secret") or params.get("secret_env")),
        }
        self.providers[alias] = record
        if self.active_provider is None:
            self.active_provider = alias
        respond(req_id, result={"provider": self._provider_view(record)})

    def provider_get(self, req_id, params):
        record = self.providers.get((params or {}).get("ref", ""))
        if record is None:
            fail(req_id, "NOT_FOUND", "Provider not found.")
            return
        respond(req_id, result={"provider": self._provider_view(record)})

    def provider_update(self, req_id, params):
        params = params or {}
        record = self.providers.get(params.get("ref", ""))
        if record is None:
            fail(req_id, "NOT_FOUND", "Provider not found.")
            return
        changed = False
        if "alias" in params and params["alias"]:
            new_alias = params["alias"]
            if new_alias != record["alias"] and new_alias in self.providers:
                fail(req_id, "CONFLICT", "Alias already exists.")
                return
            del self.providers[record["alias"]]
            record["alias"] = new_alias
            self.providers[new_alias] = record
            if self.active_provider not in self.providers:
                self.active_provider = new_alias
            changed = True
        for key in ("endpoint", "account_hint", "settings"):
            if key in params:
                record[key] = params[key]
                changed = True
        if "secret" in params or "secret_env" in params:
            record["has_credential"] = True
            changed = True
        if not changed:
            fail(req_id, "INVALID_PARAMS", "Nothing to update.")
            return
        respond(req_id, result={"provider": self._provider_view(record)})

    def provider_remove(self, req_id, params):
        params = params or {}
        record = self.providers.get(params.get("ref", ""))
        if record is None:
            fail(req_id, "NOT_FOUND", "Provider not found.")
            return
        was_active = record["alias"] == self.active_provider
        switch_to = params.get("switch_to")
        if was_active and not switch_to:
            fail(req_id, "INVALID_USAGE", "Provider is active. Select another first.")
            return
        if was_active and switch_to not in self.providers:
            fail(req_id, "NOT_FOUND", "Switch target not found.")
            return
        del self.providers[record["alias"]]
        self.models = [m for m in self.models if m["provider_id"] != record["id"]]
        if was_active:
            self.active_provider = switch_to
        respond(req_id, result={"removed": {"id": record["id"], "alias": record["alias"]}})

    def provider_test(self, req_id, params):
        record = self.providers.get((params or {}).get("ref", ""))
        if record is None:
            fail(req_id, "NOT_FOUND", "Provider not found.")
            return
        record["status_connected"] = True
        respond(req_id, result={
            "connected": True,
            "detail": "2 model(s) discovered",
            "models_discovered": 2,
            "models": [
                {"provider_model_id": "mx-1", "capabilities": None, "availability": "available"},
                {"provider_model_id": "mx-2", "capabilities": None, "availability": "available"},
            ],
        })

    def provider_discover(self, req_id, _params):
        respond(req_id, result={"candidates": []})

    def provider_use(self, req_id, params):
        record = self.providers.get((params or {}).get("ref", ""))
        if record is None:
            fail(req_id, "NOT_FOUND", "Provider not found.")
            return
        self.active_provider = record["alias"]
        active_model = next((m for m in self.models if m.get("active")), None)
        respond(req_id, result={
            "provider": self._provider_view(record),
            "model": self._model_view(active_model) if active_model else None,
        })

    def model_list(self, req_id, params):
        alias = (params or {}).get("provider")
        models = self.models
        if alias:
            ids = {r["id"] for r in self.providers.values() if r["alias"] == alias}
            models = [m for m in models if m["provider_id"] in ids]
        respond(req_id, result={"models": [self._model_view(m) for m in models]})

    def model_get(self, req_id, params):
        params = params or {}
        model = next((m for m in self.models
                      if m["id"] == params.get("ref") or m["alias"] == params.get("ref")),
                     None)
        if model is None:
            fail(req_id, "NOT_FOUND", "Model not found.")
            return
        respond(req_id, result={"model": self._model_view(model)})

    def model_add(self, req_id, params):
        params = params or {}
        record = self.providers.get(params.get("provider", ""))
        if record is None:
            fail(req_id, "NOT_FOUND", "Provider not found.")
            return
        if not params.get("provider_model_id") or not params.get("alias"):
            fail(req_id, "INVALID_PARAMS", "Model id/alias must be non-empty.")
            return
        self.model_seq += 1
        model = {
            "id": f"mdl_fake{self.model_seq}",
            "alias": params["alias"],
            "provider_id": record["id"],
            "provider_model_id": params["provider_model_id"],
            "capabilities": params.get("capabilities"),
            "availability": "unknown",
            "settings": params.get("settings") or {},
            "active": self._active_model_id() is None,
        }
        self.models.append(model)
        respond(req_id, result={"model": self._model_view(model)})

    def model_alias(self, req_id, params):
        params = params or {}
        model = next((m for m in self.models
                      if m["id"] == params.get("ref") or m["alias"] == params.get("ref")),
                     None)
        if model is None:
            fail(req_id, "NOT_FOUND", "Model not found.")
            return
        if params.get("new_alias"):
            model["alias"] = params["new_alias"]
        respond(req_id, result={"model": self._model_view(model)})

    def model_remove(self, req_id, params):
        params = params or {}
        for i, model in enumerate(self.models):
            if model["id"] == params.get("ref") or model["alias"] == params.get("ref"):
                del self.models[i]
                respond(req_id, result={"removed": {"id": model["id"], "alias": model["alias"]}})
                return
        fail(req_id, "NOT_FOUND", "Model not found.")

    def model_use(self, req_id, params):
        params = params or {}
        model = next((m for m in self.models
                      if m["id"] == params.get("ref") or m["alias"] == params.get("ref")),
                     None)
        if model is None:
            fail(req_id, "NOT_FOUND", "Model not found.")
            return
        for m in self.models:
            m["active"] = m["id"] == model["id"]
        record = next(r for r in self.providers.values() if r["id"] == model["provider_id"])
        self.active_provider = record["alias"]
        respond(req_id, result={
            "model": self._model_view(model),
            "provider": self._provider_view(record),
            "switched_provider": True,
        })

    def model_discover(self, req_id, _params):
        respond(req_id, result={"providers": {"fake": [
            {"provider_model_id": "mx-1", "capabilities": None, "availability": "available"},
            {"provider_model_id": "mx-2", "capabilities": None, "availability": "available"},
        ]}})

    def model_refresh(self, req_id, _params):
        respond(req_id, result={"providers": {"fake": {
            "saved": len(self.models), "still_available": len(self.models),
            "marked_unavailable": 0, "discovered": 2, "error": None}}})

    def model_test(self, req_id, params):
        params = params or {}
        model = next((m for m in self.models
                      if m["id"] == params.get("ref") or m["alias"] == params.get("ref")),
                     None)
        if model is None:
            fail(req_id, "NOT_FOUND", "Model not found.")
            return
        respond(req_id, result={"ok": True, "detail": "present in catalog",
                               "model": self._model_view(model)})

    def dispatch(self, message):
        req_id = message.get("id")
        method = message.get("method", "")
        params = message.get("params") or {}
        handler = {
            "engine.info": self.engine_info,
            "session.list": self.session_list,
            "session.create": self.session_create,
            "session.open": self.session_open,
            "session.mode.set": self.session_mode_set,
            "task.tree": self.task_tree,
            "task.get": self.task_get,
            "verification.latest": self.verification_latest,
            "verification.plan": self.verification_plan,
            "checkpoint.list": self.checkpoint_list,
            "checkpoint.show": self.checkpoint_show,
            "checkpoint.restore": self.checkpoint_restore,
            "project.changes": self.project_changes,
            "project.diff": self.project_diff,
            "agent.list": self.agent_list,
            "agent.config.get": self.agent_config_get,
            "agent.config.set": self.agent_config_set,
            "session.events": self.session_events,
            "session.history": self.session_history,
            "session.turn.start": self.turn_start,
            "session.turn.cancel": self.turn_cancel,
            "approval.resolve": self.approval_resolve,
            "runtime.snapshot.get": self.snapshot_get,
            "provider.list": self.provider_list,
            "provider.create": self.provider_create,
            "provider.get": self.provider_get,
            "provider.update": self.provider_update,
            "provider.remove": self.provider_remove,
            "provider.test": self.provider_test,
            "provider.discover": self.provider_discover,
            "provider.use": self.provider_use,
            "model.list": self.model_list,
            "model.get": self.model_get,
            "model.add": self.model_add,
            "model.alias": self.model_alias,
            "model.remove": self.model_remove,
            "model.use": self.model_use,
            "model.discover": self.model_discover,
            "model.refresh": self.model_refresh,
            "model.test": self.model_test,
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
