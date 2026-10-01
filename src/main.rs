use oan_cross_protocol_experiment_tools::{
    control_plane_endpoints, lifecycle_observations, CoreTopology,
};
fn main() {
    let report = serde_json::json!({"topology": CoreTopology::default(), "endpoints": control_plane_endpoints(), "lifecycle": lifecycle_observations()});
    println!("{}", serde_json::to_string_pretty(&report).unwrap());
}
