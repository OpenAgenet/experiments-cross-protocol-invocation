use oan_cross_protocol_experiment_tools::validate_control_plane_counts;
use serde::Deserialize;
use std::{env, fs, path::PathBuf};
#[derive(Deserialize)]
struct Manifest {
    mode: String,
    #[serde(rename = "registeredCount")]
    registered_count: u64,
    #[serde(rename = "discoveryIndexedCount")]
    discovery_indexed_count: u64,
    #[serde(rename = "trustIndexer")]
    trust_indexer: bool,
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dir = PathBuf::from(env::args().nth(1).ok_or("run directory required")?);
    let m: Manifest = serde_json::from_str(&fs::read_to_string(dir.join("run-manifest.json"))?)?;
    if m.mode != "real-oan-local" || m.trust_indexer {
        return Err("invalid real-run manifest".into());
    }
    validate_control_plane_counts(m.registered_count, m.discovery_indexed_count)?;
    let rows: serde_json::Value =
        serde_json::from_slice(&fs::read(dir.join("task-results.json"))?)?;
    let n = rows.as_array().map(|x| x.len()).unwrap_or(0);
    println!(
        "validated mode={} resources={} tasks={}",
        m.mode, m.registered_count, n
    );
    Ok(())
}
