//! Explicit model of the OAN repositories used by this experiment.
//! HTTP control-plane calls are intentionally kept in TypeScript adapters.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
pub mod core_preflight;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CoreNode {
    Registrar,
    Root,
    CdnPublisher,
    Cdn,
    Discovery,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlPlaneEndpoint {
    pub node: CoreNode,
    pub repository: &'static str,
    pub base_url: &'static str,
    pub health_route: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifecycleObservation {
    pub stage: &'static str,
    pub node: CoreNode,
    pub route: &'static str,
    pub required_before_native_call: bool,
}

pub fn control_plane_endpoints() -> [ControlPlaneEndpoint; 5] {
    [
        ControlPlaneEndpoint {
            node: CoreNode::Registrar,
            repository: "oan-registrar-node",
            base_url: "http://127.0.0.1:8101",
            health_route: "/health",
        },
        ControlPlaneEndpoint {
            node: CoreNode::Root,
            repository: "oan-root-services/services/root-node",
            base_url: "http://127.0.0.1:8100",
            health_route: "/root/status",
        },
        ControlPlaneEndpoint {
            node: CoreNode::CdnPublisher,
            repository: "oan-root-services/services/cdn-publisher",
            base_url: "http://127.0.0.1:8110",
            health_route: "/health",
        },
        ControlPlaneEndpoint {
            node: CoreNode::Cdn,
            repository: "oan-root-services/services/cdn-node",
            base_url: "http://127.0.0.1:8105",
            health_route: "/health",
        },
        ControlPlaneEndpoint {
            node: CoreNode::Discovery,
            repository: "oan-discovery-node/services/discovery-node",
            base_url: "http://127.0.0.1:8103",
            health_route: "/discovery/status",
        },
    ]
}

pub fn lifecycle_observations() -> [LifecycleObservation; 5] {
    [
        LifecycleObservation {
            stage: "registered",
            node: CoreNode::Registrar,
            route: "/resources/register",
            required_before_native_call: true,
        },
        LifecycleObservation {
            stage: "root-accepted",
            node: CoreNode::Root,
            route: "/root/status",
            required_before_native_call: true,
        },
        LifecycleObservation {
            stage: "cdn-published",
            node: CoreNode::CdnPublisher,
            route: "/publisher/status",
            required_before_native_call: true,
        },
        LifecycleObservation {
            stage: "discovery-indexed",
            node: CoreNode::Discovery,
            route: "/discovery/resources/query",
            required_before_native_call: true,
        },
        LifecycleObservation {
            stage: "native-invoked",
            node: CoreNode::Discovery,
            route: "local protocol endpoint",
            required_before_native_call: false,
        },
    ]
}

pub fn digest_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

pub fn validate_control_plane_counts(registered: u64, indexed: u64) -> Result<(), String> {
    if registered == 0 {
        return Err("no resources were registered through Registrar".into());
    }
    if registered != indexed {
        return Err(format!(
            "Root/Discovery count mismatch: registered={registered}, indexed={indexed}"
        ));
    }
    Ok(())
}
#[derive(Debug, Serialize)]
pub struct CoreTopology {
    pub registrar: &'static str,
    pub root: &'static str,
    pub cdn: &'static str,
    pub publisher: &'static str,
    pub discovery: &'static str,
    pub database: &'static str,
    pub trust_indexer: bool,
}
impl Default for CoreTopology {
    fn default() -> Self {
        Self {
            registrar: "oan-registrar-node",
            root: "oan-root-services/root-node",
            cdn: "oan-root-services/cdn-node",
            publisher: "oan-root-services/cdn-publisher",
            discovery: "oan-discovery-node/discovery-node",
            database: "sqlite",
            trust_indexer: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lifecycle_requires_core_before_native() {
        assert!(lifecycle_observations()[..4]
            .iter()
            .all(|x| x.required_before_native_call));
        assert!(!lifecycle_observations()[4].required_before_native_call);
    }
    #[test]
    fn count_validation_is_fail_closed() {
        assert!(validate_control_plane_counts(4, 4).is_ok());
        assert!(validate_control_plane_counts(4, 3).is_err());
    }
}
