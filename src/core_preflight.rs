use oan_client::OanClient;
use oan_core::ResourceType;
use oan_protocol::{PATH_CDN_RESOURCES, PATH_ROOT_RESOURCES_VERIFY_AND_PUBLISH, PROTOCOL_VERSION};
use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Serialize)]
pub struct RepositoryCheck {
    pub name: &'static str,
    pub path: String,
    pub version: String,
    pub required_packages: Vec<&'static str>,
    pub sqlite_enabled: bool,
    pub binaries_present: bool,
}
#[derive(Debug, Serialize)]
pub struct LiveNodeCheck {
    pub name: &'static str,
    pub endpoint: &'static str,
    pub route: &'static str,
    pub reachable: bool,
    pub node_type: Option<String>,
    pub error: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct CorePreflightReport {
    pub protocol_version: &'static str,
    pub protocol_constants: Value,
    pub resource_types: Vec<&'static str>,
    pub repositories: Vec<RepositoryCheck>,
    pub genesis_identities: Vec<String>,
    pub live_nodes: Vec<LiveNodeCheck>,
    pub passed: bool,
}

fn manifest_version(path: &Path) -> Result<String, String> {
    let value: toml::Value = toml::from_str(&fs::read_to_string(path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(value
        .get("workspace")
        .and_then(|x| x.get("package"))
        .and_then(|x| x.get("version"))
        .and_then(|x| x.as_str())
        .unwrap_or("unknown")
        .to_owned())
}
fn contains_all(path: &Path, needles: &[&str]) -> bool {
    fs::read_to_string(path)
        .map(|s| needles.iter().all(|n| s.contains(n)))
        .unwrap_or(false)
}
fn executable(root: &Path, name: &str) -> PathBuf {
    root.join("target/debug")
        .join(format!("{}{}", name, std::env::consts::EXE_SUFFIX))
}
fn repo(
    root: &Path,
    name: &'static str,
    dir: &str,
    packages: Vec<&'static str>,
) -> Result<RepositoryCheck, String> {
    let p = root.join(dir);
    if !p.is_dir() {
        return Err(format!("missing OAN core repository: {}", p.display()));
    }
    let cargo = p.join("Cargo.toml");
    let sqlite_enabled = contains_all(&cargo, &["sqlx", "sqlite"]);
    let binaries_present = packages.iter().all(|x| executable(&p, x).is_file());
    Ok(RepositoryCheck {
        name,
        path: p.display().to_string(),
        version: manifest_version(&cargo)?,
        required_packages: packages,
        sqlite_enabled,
        binaries_present,
    })
}
async fn live(name: &'static str, endpoint: &'static str, route: &'static str) -> LiveNodeCheck {
    match OanClient::new(endpoint) {
        Ok(c) => match c.get_json::<Value>(route).await {
            Ok(v) => LiveNodeCheck {
                name,
                endpoint,
                route,
                reachable: true,
                node_type: v
                    .get("nodeType")
                    .or_else(|| v.get("node_type"))
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                error: None,
            },
            Err(e) => LiveNodeCheck {
                name,
                endpoint,
                route,
                reachable: false,
                node_type: None,
                error: Some(e.to_string()),
            },
        },
        Err(e) => LiveNodeCheck {
            name,
            endpoint,
            route,
            reachable: false,
            node_type: None,
            error: Some(e.to_string()),
        },
    }
}

pub async fn inspect(workspace: &Path, require_live: bool) -> Result<CorePreflightReport, String> {
    let repositories = vec![
        repo(
            workspace,
            "Root services",
            "oan-root-services",
            vec!["root-node", "cdn-node", "cdn-publisher"],
        )?,
        repo(
            workspace,
            "Registrar",
            "oan-registrar-node",
            vec!["registrar-node"],
        )?,
        repo(
            workspace,
            "Discovery",
            "oan-discovery-node",
            vec!["discovery-node"],
        )?,
        repo(workspace, "Protocol common", "oan-protocol-common", vec![])?,
    ];
    let identities = ["genesis-root", "genesis-registrar-1", "genesis-discovery-1"]
        .iter()
        .map(|n| {
            workspace
                .join("oan-design-docs/genesis/nodes")
                .join(n)
                .join("did-document.json")
        })
        .map(|p| {
            if !p.is_file() {
                Err(format!("missing genesis identity: {}", p.display()))
            } else {
                Ok(p.display().to_string())
            }
        })
        .collect::<Result<Vec<_>, _>>()?;
    let live_nodes = vec![
        live("Root", "http://127.0.0.1:8100", "/health").await,
        live("Registrar", "http://127.0.0.1:8101", "/health").await,
        live("Discovery", "http://127.0.0.1:8103", "/health").await,
        live("CDN", "http://127.0.0.1:8105", "/health").await,
        live("CDN Publisher", "http://127.0.0.1:8110", "/health").await,
    ];
    let repositories_ok = repositories
        .iter()
        .all(|r| r.sqlite_enabled || r.name == "Protocol common")
        && repositories.iter().all(|r| r.binaries_present);
    let live_ok = !require_live || live_nodes.iter().all(|n| n.reachable);
    Ok(CorePreflightReport {
        protocol_version: PROTOCOL_VERSION,
        protocol_constants: serde_json::json!({"rootVerifyAndPublish":PATH_ROOT_RESOURCES_VERIFY_AND_PUBLISH,"cdnResources":PATH_CDN_RESOURCES}),
        resource_types: vec![
            ResourceType::McpServer.as_str(),
            ResourceType::Skill.as_str(),
            ResourceType::ToolApi.as_str(),
            ResourceType::AgentService.as_str(),
        ],
        repositories,
        genesis_identities: identities,
        live_nodes,
        passed: repositories_ok && live_ok,
    })
}
