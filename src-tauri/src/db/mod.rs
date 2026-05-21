pub mod commands;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: String,
    pub ssl: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    #[serde(rename = "rowCount")]
    pub row_count: usize,
    #[serde(rename = "executionTime")]
    pub execution_time_ms: u64,
    #[serde(rename = "affectedRows")]
    pub affected_rows: Option<u64>,
}

#[derive(Clone)]
pub enum DbConnection {
    Postgres(sqlx::PgPool),
    Mysql(sqlx::MySqlPool),
}

pub struct AppState {
    pub connections: Mutex<HashMap<String, DbConnection>>,
    pub active_profile: Mutex<Option<String>>,
}
