//! Provider commands: CRUD, test, discovery, selection.
use tauri::State;

use rinari_agent_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) async fn provider_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, |engine| engine.provider_list()).await
}

#[tauri::command(rename_all = "snake_case")]
#[allow(clippy::too_many_arguments)]
pub(crate) async fn provider_create(
    supervisor: State<'_, EngineSupervisor>,
    alias: String,
    provider_type: String,
    auth_method: Option<String>,
    endpoint: Option<String>,
    account_hint: Option<String>,
    secret: Option<String>,
    secret_env: Option<String>,
    settings: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    // Secrets travel only in memory to the local engine child, which stores
    // them via its credential backend. They never touch frontend storage.
    if provider_type.is_empty() {
        return Err("provider_create requires provider_type (app 0.1.1)"
            .to_string()
            .into());
    }
    let params = serde_json::json!({
        "alias": alias,
        "type": provider_type,
        "auth_method": auth_method,
        "endpoint": endpoint,
        "account_hint": account_hint,
        "secret": secret,
        "secret_env": secret_env,
        "settings": settings,
    });
    super::run_engine(supervisor, move |engine| engine.provider_create(params)).await
}

#[tauri::command]
pub(crate) async fn provider_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.provider_get(&reference)).await
}

#[tauri::command(rename_all = "snake_case")]
#[allow(clippy::too_many_arguments)]
pub(crate) async fn provider_update(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    alias: Option<String>,
    endpoint: Option<String>,
    account_hint: Option<String>,
    secret: Option<String>,
    secret_env: Option<String>,
    settings: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    let mut params = serde_json::Map::new();
    params.insert("ref".to_string(), serde_json::Value::String(reference));
    if let Some(v) = alias {
        params.insert("alias".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = endpoint {
        params.insert("endpoint".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = account_hint {
        params.insert("account_hint".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = secret {
        params.insert("secret".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = secret_env {
        params.insert("secret_env".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = settings {
        params.insert("settings".to_string(), v);
    }
    super::run_engine(supervisor, move |engine| {
        engine.provider_update(serde_json::Value::Object(params))
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn provider_remove(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    switch_to: Option<String>,
    keep_credentials: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.provider_remove(&reference, switch_to, keep_credentials.unwrap_or(false))
    })
    .await
}

#[tauri::command]
pub(crate) async fn provider_test(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.provider_test(&reference)).await
}

#[tauri::command]
pub(crate) async fn provider_discover(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, |engine| engine.provider_discover()).await
}

#[tauri::command]
pub(crate) async fn provider_use(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.provider_use(&reference)).await
}
