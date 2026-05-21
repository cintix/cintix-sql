use crate::db::{AppState, ConnectionProfile, DbConnection, QueryResult};
use serde::{Deserialize, Serialize};
use serde_json;
use sqlx::{Column, Row};
use std::fs;
use std::time::Instant;
use tauri::State;

fn profiles_path() -> std::path::PathBuf {
    let dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("cintix-sql");
    fs::create_dir_all(&dir).ok();
    dir.join("profiles.json")
}

fn load_profiles() -> Vec<ConnectionProfile> {
    let path = profiles_path();
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        vec![]
    }
}

fn save_profiles(profiles: &[ConnectionProfile]) {
    let path = profiles_path();
    if let Ok(json) = serde_json::to_string_pretty(profiles) {
        fs::write(path, json).ok();
    }
}

#[tauri::command]
pub fn get_profiles() -> Vec<ConnectionProfile> {
    load_profiles()
}

#[tauri::command]
pub fn save_profile(profile: ConnectionProfile) -> Result<Vec<ConnectionProfile>, String> {
    let mut profiles = load_profiles();
    if let Some(idx) = profiles.iter().position(|p| p.id == profile.id) {
        profiles[idx] = profile;
    } else {
        profiles.push(profile);
    }
    save_profiles(&profiles);
    Ok(profiles)
}

#[tauri::command]
pub fn delete_profile(id: String) -> Result<Vec<ConnectionProfile>, String> {
    let mut profiles = load_profiles();
    profiles.retain(|p| p.id != id);
    save_profiles(&profiles);
    Ok(profiles)
}

#[tauri::command]
pub async fn connect(
    state: State<'_, AppState>,
    profile: ConnectionProfile,
) -> Result<String, String> {
    let pool = match profile.db_type.as_str() {
        "postgresql" => {
            let url = format!(
                "postgresql://{}:{}@{}:{}/{}",
                profile.username, profile.password, profile.host, profile.port, profile.database
            );
            sqlx::PgPool::connect(&url)
                .await
                .map(DbConnection::Postgres)
                .map_err(|e| format!("PostgreSQL connection failed: {}", e))?
        }
        "mysql" => {
            let url = format!(
                "mysql://{}:{}@{}:{}/{}",
                profile.username, profile.password, profile.host, profile.port, profile.database
            );
            sqlx::MySqlPool::connect(&url)
                .await
                .map(DbConnection::Mysql)
                .map_err(|e| format!("MySQL connection failed: {}", e))?
        }
        "sqlserver" => {
            return Err("SQL Server requires the tiberius driver. Please install ODBC Driver 17 for SQL Server or use a compatible setup.".into());
        }
        _ => return Err(format!("Unsupported database type: {}", profile.db_type)),
    };

    let mut connections = state.connections.lock().map_err(|e| e.to_string())?;
    connections.insert(profile.id.clone(), pool);
    *state.active_profile.lock().map_err(|e| e.to_string())? = Some(profile.id.clone());

    Ok(profile.id)
}

#[tauri::command]
pub async fn disconnect(state: State<'_, AppState>) -> Result<(), String> {
    let mut connections = state.connections.lock().map_err(|e| e.to_string())?;
    connections.clear();
    *state.active_profile.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

#[tauri::command]
pub async fn execute_query(
    state: State<'_, AppState>,
    profile_id: String,
    sql: String,
) -> Result<QueryResult, String> {
    {
        let active = state
            .active_profile
            .lock()
            .map_err(|e| e.to_string())?;
        if active.as_ref() != Some(&profile_id) {
            return Err("Not connected to this profile".into());
        }
    }

    let conn = {
        let connections = state.connections.lock().map_err(|e| e.to_string())?;
        connections
            .get(&profile_id)
            .cloned()
            .ok_or("Connection not found")?
    };

    let start = Instant::now();

    match conn {
        DbConnection::Postgres(pool) => execute_pg(&pool, &sql, start).await,
        DbConnection::Mysql(pool) => execute_mysql(&pool, &sql, start).await,
    }
}

async fn execute_pg(
    pool: &sqlx::PgPool,
    sql: &str,
    start: Instant,
) -> Result<QueryResult, String> {
    let trimmed = sql.trim().to_uppercase();
    if trimmed.starts_with("SELECT") || trimmed.starts_with("SHOW") || trimmed.starts_with("EXPLAIN") || trimmed.starts_with("WITH") {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Query error: {}", e))?;

        let columns: Vec<String> = if rows.is_empty() {
            vec![]
        } else {
            rows[0]
                .columns()
                .iter()
                .map(|c| c.name().to_string())
                .collect()
        };

        let data: Vec<Vec<serde_json::Value>> = rows
            .iter()
            .map(|row| {
                (0..columns.len())
                    .map(|i| {
                        let val: Result<String, _> = row.try_get(i);
                        match val {
                            Ok(v) => serde_json::Value::String(v),
                            Err(_) => serde_json::Value::Null,
                        }
                    })
                    .collect()
            })
            .collect();

        let row_count = data.len();
        Ok(QueryResult {
            columns,
            rows: data,
            row_count,
            execution_time_ms: start.elapsed().as_millis() as u64,
            affected_rows: None,
        })
    } else {
        let result = sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| format!("Query error: {}", e))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            row_count: 0,
            execution_time_ms: start.elapsed().as_millis() as u64,
            affected_rows: Some(result.rows_affected()),
        })
    }
}

async fn execute_mysql(
    pool: &sqlx::MySqlPool,
    sql: &str,
    start: Instant,
) -> Result<QueryResult, String> {
    let trimmed = sql.trim().to_uppercase();
    if trimmed.starts_with("SELECT") || trimmed.starts_with("SHOW") || trimmed.starts_with("EXPLAIN") || trimmed.starts_with("WITH") || trimmed.starts_with("DESCRIBE") {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Query error: {}", e))?;

        let columns: Vec<String> = if rows.is_empty() {
            vec![]
        } else {
            rows[0]
                .columns()
                .iter()
                .map(|c| c.name().to_string())
                .collect()
        };

        let data: Vec<Vec<serde_json::Value>> = rows
            .iter()
            .map(|row| {
                (0..columns.len())
                    .map(|i| {
                        let val: Result<String, _> = row.try_get(i);
                        match val {
                            Ok(v) => serde_json::Value::String(v),
                            Err(_) => serde_json::Value::Null,
                        }
                    })
                    .collect()
            })
            .collect();

        let row_count = data.len();
        Ok(QueryResult {
            columns,
            rows: data,
            row_count,
            execution_time_ms: start.elapsed().as_millis() as u64,
            affected_rows: None,
        })
    } else {
        let result = sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| format!("Query error: {}", e))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            row_count: 0,
            execution_time_ms: start.elapsed().as_millis() as u64,
            affected_rows: Some(result.rows_affected()),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SchemaObject {
    pub name: String,
    #[serde(rename = "type")]
    pub obj_type: String,
    pub schema: String,
}

#[tauri::command]
pub async fn get_schema_objects(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Vec<SchemaObject>, String> {
    let conn = {
        let connections = state.connections.lock().map_err(|e| e.to_string())?;
        connections.get(&profile_id).cloned().ok_or("Not connected")?
    };

    match conn {
        DbConnection::Postgres(pool) => {
            let tables = sqlx::query(
                "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' ORDER BY table_schema, table_name"
            )
            .fetch_all(&pool).await.map_err(|e| e.to_string())?;
            let views = sqlx::query(
                "SELECT table_schema, table_name FROM information_schema.views ORDER BY table_schema, table_name"
            )
            .fetch_all(&pool).await.map_err(|e| e.to_string())?;
            let functions = sqlx::query(
                "SELECT routine_schema, routine_name FROM information_schema.routines ORDER BY routine_schema, routine_name"
            )
            .fetch_all(&pool).await.map_err(|e| e.to_string())?;

            let mut objects = Vec::new();
            for row in &tables {
                objects.push(SchemaObject {
                    schema: row.get::<String, _>(0),
                    name: row.get::<String, _>(1),
                    obj_type: "table".into(),
                });
            }
            for row in &views {
                objects.push(SchemaObject {
                    schema: row.get::<String, _>(0),
                    name: row.get::<String, _>(1),
                    obj_type: "view".into(),
                });
            }
            for row in &functions {
                objects.push(SchemaObject {
                    schema: row.get::<String, _>(0),
                    name: row.get::<String, _>(1),
                    obj_type: "function".into(),
                });
            }
            Ok(objects)
        }
        DbConnection::Mysql(pool) => {
            let tables = sqlx::query(
                "SELECT TABLE_SCHEMA, TABLE_NAME FROM information_schema.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME"
            )
            .fetch_all(&pool).await.map_err(|e| e.to_string())?;
            let views = sqlx::query(
                "SELECT TABLE_SCHEMA, TABLE_NAME FROM information_schema.VIEWS ORDER BY TABLE_SCHEMA, TABLE_NAME"
            )
            .fetch_all(&pool).await.map_err(|e| e.to_string())?;
            let functions = sqlx::query(
                "SELECT ROUTINE_SCHEMA, ROUTINE_NAME FROM information_schema.ROUTINES ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME"
            )
            .fetch_all(&pool).await.map_err(|e| e.to_string())?;

            let mut objects = Vec::new();
            for row in &tables {
                objects.push(SchemaObject {
                    schema: row.get::<String, _>(0),
                    name: row.get::<String, _>(1),
                    obj_type: "table".into(),
                });
            }
            for row in &views {
                objects.push(SchemaObject {
                    schema: row.get::<String, _>(0),
                    name: row.get::<String, _>(1),
                    obj_type: "view".into(),
                });
            }
            for row in &functions {
                objects.push(SchemaObject {
                    schema: row.get::<String, _>(0),
                    name: row.get::<String, _>(1),
                    obj_type: "function".into(),
                });
            }
            Ok(objects)
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ObjectScript {
    pub script: String,
}

#[tauri::command]
pub async fn get_object_script(
    state: State<'_, AppState>,
    profile_id: String,
    object_type: String,
    object_name: String,
    schema_name: String,
) -> Result<ObjectScript, String> {
    let conn = {
        let connections = state.connections.lock().map_err(|e| e.to_string())?;
        connections.get(&profile_id).cloned().ok_or("Not connected")?
    };

    match conn {
        DbConnection::Postgres(pool) => {
            let script = match object_type.as_str() {
                "table" => {
                    let columns = sqlx::query(
                        "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position"
                    )
                    .bind(&schema_name).bind(&object_name)
                    .fetch_all(&pool).await.map_err(|e| e.to_string())?;
                    let mut s = format!("CREATE TABLE \"{}\".\"{}\" (\n", schema_name, object_name);
                    for (i, row) in columns.iter().enumerate() {
                        let col: String = row.get(0);
                        let dtype: String = row.get(1);
                        let nullable: String = row.get(2);
                        let default: Option<String> = row.get(3);
                        if i > 0 { s.push_str(",\n"); }
                        s.push_str(&format!("    \"{}\" {}", col, dtype));
                        if nullable == "NO" { s.push_str(" NOT NULL"); }
                        if let Some(d) = default { s.push_str(&format!(" DEFAULT {}", d)); }
                    }
                    s.push_str("\n);");
                    s
                }
                "view" => {
                    let def: String = sqlx::query_scalar(
                        "SELECT pg_get_viewdef($1::regclass)"
                    )
                    .bind(format!("\"{}\".\"{}\"", schema_name, object_name))
                    .fetch_one(&pool).await
                    .map_err(|e| format!("View not found: {}", e))?;
                    format!("CREATE VIEW \"{}\".\"{}\" AS\n{}", schema_name, object_name, def)
                }
                "function" => {
                    let def: String = sqlx::query_scalar(
                        "SELECT pg_get_functiondef($1::regproc)"
                    )
                    .bind(format!("\"{}\".\"{}\"", schema_name, object_name))
                    .fetch_one(&pool).await
                    .map_err(|e| format!("Function not found: {}", e))?;
                    def
                }
                _ => format!("-- DDL not available for: {}", object_type),
            };
            Ok(ObjectScript { script })
        }
        DbConnection::Mysql(pool) => {
            let script = match object_type.as_str() {
                "table" => {
                    let result = sqlx::query(&format!("SHOW CREATE TABLE `{}`.`{}`", schema_name, object_name))
                        .fetch_one(&pool).await.map_err(|e| e.to_string())?;
                    result.get::<String, _>(1)
                }
                "view" => {
                    let result = sqlx::query(&format!("SHOW CREATE VIEW `{}`.`{}`", schema_name, object_name))
                        .fetch_one(&pool).await.map_err(|e| e.to_string())?;
                    result.get::<String, _>(1)
                }
                "function" => {
                    let result = sqlx::query(&format!("SHOW CREATE FUNCTION `{}`.`{}`", schema_name, object_name))
                        .fetch_one(&pool).await.map_err(|e| e.to_string())?;
                    let fields: Vec<String> = result.columns().iter().map(|c| c.name().to_string()).collect();
                    if fields.len() > 3 {
                        result.get::<String, _>(3)
                    } else {
                        result.get::<String, _>(2)
                    }
                }
                _ => format!("-- DDL not available for: {}", object_type),
            };
            Ok(ObjectScript { script })
        }
    }
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Cannot read file: {}", e))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("Cannot write file: {}", e))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub data_type: String,
    pub nullable: bool,
}

#[tauri::command]
pub async fn get_columns(
    state: State<'_, AppState>,
    profile_id: String,
    schema_name: String,
    table_name: String,
) -> Result<Vec<ColumnInfo>, String> {
    let conn = {
        let connections = state.connections.lock().map_err(|e| e.to_string())?;
        connections.get(&profile_id).cloned().ok_or("Not connected")?
    };

    match conn {
        DbConnection::Postgres(pool) => {
            let rows = sqlx::query(
                "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position"
            )
            .bind(&schema_name).bind(&table_name)
            .fetch_all(&pool).await.map_err(|e| e.to_string())?;
            Ok(rows.iter().map(|r| ColumnInfo {
                name: r.get(0),
                data_type: r.get(1),
                nullable: r.get::<String, _>(2) == "YES",
            }).collect())
        }
        DbConnection::Mysql(pool) => {
            let rows = sqlx::query(
                "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION"
            )
            .bind(&schema_name).bind(&table_name)
            .fetch_all(&pool).await.map_err(|e| e.to_string())?;
            Ok(rows.iter().map(|r| ColumnInfo {
                name: r.get(0),
                data_type: r.get(1),
                nullable: r.get::<String, _>(2) == "YES",
            }).collect())
        }
    }
}
