use oan_cross_protocol_experiment_tools::core_preflight;
use std::{env, fs, path::PathBuf};
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let workspace =
        PathBuf::from(env::var("OAN_WORKSPACE_ROOT").unwrap_or_else(|_| "../../../../..".into()))
            .canonicalize()?;
    let live = env::args().any(|x| x == "--live");
    let output = env::args().skip_while(|x| x != "--output").nth(1);
    let report = core_preflight::inspect(&workspace, live).await?;
    let json = serde_json::to_string_pretty(&report)?;
    if let Some(p) = output {
        fs::write(p, json.as_bytes())?;
    }
    println!("{json}");
    if !report.passed {
        return Err("OAN core preflight failed".into());
    }
    Ok(())
}
