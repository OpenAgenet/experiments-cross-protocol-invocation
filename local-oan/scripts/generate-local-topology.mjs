// Copyright (c) 2026 OpenAgenet contributors
//
// Initial author: JINLIANG XU
// Email: jlxufly@gmail.com

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const harnessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = process.env.OAN_WORKSPACE_ROOT ?? path.resolve(harnessRoot, "..", "..", "..", "..", "..");
const designDocsDir = process.env.OAN_DESIGN_DOCS_ROOT ?? path.join(workspaceRoot, "oan-design-docs");
const genesisNodesDir = process.env.OAN_GENESIS_NODES_ROOT ?? path.join(designDocsDir, "genesis", "nodes");
const outputDir =
  process.env.OAN_LOCAL_TOPOLOGY_ROOT ?? path.join(harnessRoot, ".local-oan-topology");
const CRYPTO_SUITE = "Ed25519Sha256";
const HASH_ALGORITHM = "SHA-256";
const databaseRunSuffix =
  process.env.OAN_MULTI_NODE_DB_SUFFIX ??
  new Date().toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "_").replace("Z", "");

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes) {
  if (bytes.length === 0) return "";
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let result = "";
  for (const byte of bytes) {
    if (byte === 0) result += BASE58_ALPHABET[0];
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function didToFileName(did) {
  return `${did.replaceAll(":", "_")}.json`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
}

function withDatabaseSuffix(configText) {
  return configText.replace(
    /(database_url\s*=\s*"postgres:\/\/postgres:postgres@127\.0\.0\.1:5432\/)([^"\r\n]+)"/g,
    (_, prefix, dbName) => `${prefix}${dbName}_${databaseRunSuffix}"`,
  );
}

function generateIdentity({
  semanticCode,
  subjectType,
  identityType,
  role,
  description,
  capabilityTags,
  services,
}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" });
  const privateJwk = privateKey.export({ format: "jwk" });
  const publicKeyRaw = Buffer.from(publicJwk.x, "base64url");
  const did = `did:oan:${semanticCode}:${base58Encode(publicKeyRaw)}`;
  const keyId = `${did}#key-1`;
  const didDocument = {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/oan/v1"],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: "Ed25519VerificationKey2020",
        controller: did,
        cryptoSuite: CRYPTO_SUITE,
        publicKeyFormat: "multibase",
        publicKeyMultibase: `z${base58Encode(publicKeyRaw)}`,
        publicKeyJwk: publicJwk,
      },
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
    service: services.map((service) => ({
      id: `${did}${service.fragment}`,
      type: service.type,
      serviceEndpoint: service.endpoint,
      version: "1.0.0",
      protocol: "http",
      serverType: service.serverType,
      port: service.port,
    })),
    oanMetadata: {
      subjectType,
      identityType,
      ttl: 300,
      addressBindings: services.map((service) => ({
        id: `${did}${service.fragment.replace("#", "#addr-")}`,
        addressType: "endpoint",
        network: "local-http",
        address: service.endpoint,
        controller: did,
        purpose: "service",
      })),
      agentDescription: {
        capabilityDescription: description,
        capabilityTags,
        useCaseExamples: services.length
          ? ["Provide governance or discovery endpoints.", "Support local multi-node demonstration."]
          : ["Discover a Service Agent.", "Submit or verify a registration package."],
      },
      servicePolicy: "public-local-resolution",
      networkScope: "oan-local",
    },
  };

  return {
    did,
    keyId,
    publicJwk,
    privateJwk,
    didDocument,
    didDocumentHash: sha256Hex(canonicalJson(didDocument)),
  };
}

function signEvent(rootPrivateKey, event) {
  const eventHash = sha256Hex(canonicalJson(event));
  const proofPayload = { eventHash };
  const proofInput = Buffer.from(sha256Hex(canonicalJson(proofPayload)), "utf8");
  const signature = crypto.sign(null, proofInput, rootPrivateKey).toString("base64url");
  return {
    ...event,
    eventHash,
    signature,
    proof: {
      type: "Ed25519Signature2020",
      creator: root.keyId,
      created: event.createdAt,
      proofPurpose: "assertionMethod",
      proofValue: signature,
      cryptoSuite: CRYPTO_SUITE,
      hashAlgorithm: HASH_ALGORITHM,
      verificationMethod: root.keyId,
    },
    cryptoSuite: CRYPTO_SUITE,
    hashAlgorithm: HASH_ALGORITHM,
  };
}

function writeNode(nodeDir, identity) {
  writeJson(path.join(nodeDir, "did-document.json"), identity.didDocument);
  writeJson(path.join(nodeDir, "keys", "keypair.json"), {
    warning: "Development key only. Do not use in production.",
    did: identity.did,
    keyId: identity.keyId,
    algorithm: "Ed25519",
    cryptoSuite: CRYPTO_SUITE,
    publicKeyMultibase: identity.didDocument.verificationMethod[0].publicKeyMultibase,
    publicKeyJwk: identity.publicJwk,
    privateKeyJwk: identity.privateJwk,
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function copyFileIfExists(source, target) {
  if (fs.existsSync(source)) {
    ensureDir(path.dirname(target));
    fs.copyFileSync(source, target);
  }
}

function rewriteServiceEndpoints(didDocument, endpoint) {
  for (const service of Array.isArray(didDocument.service) ? didDocument.service : []) {
    if (!service || typeof service !== "object" || typeof service.serviceEndpoint !== "string") continue;
    const pathSuffix = new URL(service.serviceEndpoint).pathname.replace(/\/$/, "");
    service.serviceEndpoint = `${endpoint}${pathSuffix === "/" ? "" : pathSuffix}`;
    service.protocol = endpoint.startsWith("https:") ? "https" : "http";
    service.port = Number(new URL(endpoint).port || (endpoint.startsWith("https:") ? 443 : 80));
  }
  const bindings = didDocument.oanMetadata?.addressBindings;
  if (Array.isArray(bindings)) {
    for (const binding of bindings) {
      if (!binding || typeof binding !== "object" || typeof binding.address !== "string") continue;
      let pathSuffix = "";
      try {
        pathSuffix = new URL(binding.address).pathname.replace(/\/$/, "");
      } catch {
        continue;
      }
      binding.address = `${endpoint}${pathSuffix === "/" ? "" : pathSuffix}`;
      binding.network = "local-http";
    }
  }
  if (didDocument.oanMetadata) {
    didDocument.oanMetadata.networkScope = "oan-local";
  }
}

function normalizeGenesisVerificationMethods(didDocument) {
  for (const method of Array.isArray(didDocument.verificationMethod) ? didDocument.verificationMethod : []) {
    if (!method || typeof method !== "object") continue;
    const jwk = method.publicKeyJwk;
    if (!method.cryptoSuite && jwk?.crv === "Ed25519") {
      method.cryptoSuite = CRYPTO_SUITE;
    }
    if (!method.publicKeyFormat && jwk?.crv === "Ed25519") {
      method.publicKeyFormat = "multibase";
    }
    if (!method.publicKeyMultibase && typeof jwk?.x === "string") {
      method.publicKeyMultibase = `z${base58Encode(Buffer.from(jwk.x, "base64url"))}`;
    }
  }
}

function loadGenesisIdentity(nodeId, endpoint) {
  const nodeDir = path.join(genesisNodesDir, nodeId);
  if (!fs.existsSync(nodeDir)) {
    throw new Error(`Missing genesis node identity: ${nodeDir}`);
  }
  const didDocument = readJson(path.join(nodeDir, "did-document.json"));
  normalizeGenesisVerificationMethods(didDocument);
  rewriteServiceEndpoints(didDocument, endpoint);
  const publicJwk = readJson(path.join(nodeDir, "public-key.jwk.json"));
  const privateJwk = readJson(path.join(nodeDir, "private-key.jwk.json"));
  const did = String(didDocument.id);
  const keyId = String(privateJwk.kid ?? publicJwk.kid ?? `${did}#key-1`);
  return {
    did,
    keyId,
    publicJwk,
    privateJwk,
    didDocument,
    didDocumentHash: sha256Hex(canonicalJson(didDocument)),
    authorizedDomains: didDocumentAuthorizedDomains(didDocument),
    genesisNodeDir: nodeDir,
  };
}

function didDocumentAuthorizedDomains(didDocument) {
  const domains = didDocument.oanMetadata?.authorizedDomains;
  return Array.isArray(domains) ? domains.map(String) : ["technology.software_engineering"];
}

function writeGenesisNode(nodeDir, identity) {
  writeNode(nodeDir, identity);
  copyFileIfExists(
    path.join(identity.genesisNodeDir, "root-authorization-vc.json"),
    path.join(nodeDir, "credentials", "root-authorization-vc.json"),
  );
  copyFileIfExists(
    path.join(identity.genesisNodeDir, "chain-governance-notice.json"),
    path.join(nodeDir, "credentials", "chain-governance-notice.json"),
  );
}

fs.rmSync(outputDir, { recursive: true, force: true });
ensureDir(outputDir);

const root = loadGenesisIdentity("genesis-root", "http://localhost:8100");
const registrarA = loadGenesisIdentity("genesis-registrar-1", "http://localhost:8101");
const registrarB = loadGenesisIdentity("genesis-registrar-2", "http://localhost:8102");
const registrarC = loadGenesisIdentity("genesis-registrar-3", "http://localhost:8106");
const discoveryA = loadGenesisIdentity("genesis-discovery-1", "http://localhost:8103");
const discoveryB = loadGenesisIdentity("genesis-discovery-2", "http://localhost:8104");

const cdn = generateIdentity({
  semanticCode: "AGCN",
  subjectType: "infrastructure-node",
  identityType: "cdn-service",
  role: "CDN Service",
  description: "Local CDN service for verified packages and metadata.",
  capabilityTags: ["cdn", "distribution"],
  services: [{ fragment: "#cdn-api", type: "CdnService", endpoint: "http://localhost:8105", serverType: "local-cdn", port: 8105 }],
});

for (const [nodeName, identity] of Object.entries({
  root,
  "registrar-a": registrarA,
  "registrar-b": registrarB,
  "registrar-c": registrarC,
  "discovery-a": discoveryA,
  "discovery-b": discoveryB,
})) {
  writeGenesisNode(path.join(outputDir, nodeName), identity);
}
writeNode(path.join(outputDir, "cdn"), cdn);

ensureDir(path.join(outputDir, "registrar-a", "credentials"));
ensureDir(path.join(outputDir, "registrar-b", "credentials"));
ensureDir(path.join(outputDir, "registrar-c", "credentials"));
ensureDir(path.join(outputDir, "discovery-a", "credentials"));
ensureDir(path.join(outputDir, "discovery-b", "credentials"));

const createdAt = "2026-05-21T00:00:00Z";
const rootPrivateKey = crypto.createPrivateKey({ key: root.privateJwk, format: "jwk" });
const bulletinEvents = [
  {
    sequence: 1,
    previousHash: null,
    eventType: "ROOT_INITIALIZED",
    subjectDid: root.did,
    actorDid: root.did,
    payload: { didDocumentHash: root.didDocumentHash },
    createdAt,
  },
  {
    sequence: 2,
    previousHash: null,
    eventType: "CDN_SERVICE_INFO_UPDATED",
    subjectDid: root.did,
    actorDid: root.did,
    payload: {
      serviceId: "multi-node-cdn",
      providerType: "local",
      baseUrl: "http://localhost:8105",
      manifestUrl: "http://localhost:8105/cdn/manifest",
      updatesUrl: "http://localhost:8105/cdn/updates",
      documentsUrlTemplate: "http://localhost:8105/cdn/documents/{did}",
      packagesUrlTemplate: "http://localhost:8105/cdn/packages/{did}",
      metadataUrlTemplate: "http://localhost:8105/cdn/metadata/{did}",
      status: "active",
      validFrom: createdAt,
      validUntil: null,
    },
    createdAt,
  },
  {
    sequence: 3,
    previousHash: null,
    eventType: "REGISTRAR_AUTHORIZED",
    subjectDid: registrarA.did,
    actorDid: root.did,
    payload: { didDocumentHash: registrarA.didDocumentHash, authorizedDomains: registrarA.authorizedDomains },
    createdAt,
  },
  {
    sequence: 4,
    previousHash: null,
    eventType: "REGISTRAR_AUTHORIZED",
    subjectDid: registrarB.did,
    actorDid: root.did,
    payload: { didDocumentHash: registrarB.didDocumentHash, authorizedDomains: registrarB.authorizedDomains },
    createdAt,
  },
  {
    sequence: 5,
    previousHash: null,
    eventType: "REGISTRAR_AUTHORIZED",
    subjectDid: registrarC.did,
    actorDid: root.did,
    payload: { didDocumentHash: registrarC.didDocumentHash, authorizedDomains: registrarC.authorizedDomains },
    createdAt,
  },
  {
    sequence: 6,
    previousHash: null,
    eventType: "DISCOVERY_NODE_AUTHORIZED",
    subjectDid: discoveryA.did,
    actorDid: root.did,
    payload: { didDocumentHash: discoveryA.didDocumentHash, authorizedDomains: discoveryA.authorizedDomains, tagTreeVersion: 1 },
    createdAt,
  },
  {
    sequence: 7,
    previousHash: null,
    eventType: "DISCOVERY_NODE_AUTHORIZED",
    subjectDid: discoveryB.did,
    actorDid: root.did,
    payload: { didDocumentHash: discoveryB.didDocumentHash, authorizedDomains: discoveryB.authorizedDomains, tagTreeVersion: 1 },
    createdAt,
  },
];

let prevHash = null;
const signedEvents = bulletinEvents.map((event) => {
  const signed = signEvent(rootPrivateKey, { ...event, previousHash: prevHash });
  prevHash = signed.eventHash;
  return signed;
});

writeJson(path.join(outputDir, "root", "bulletin.json"), {
  version: "0.1.0",
  rootDid: root.did,
  createdAt,
  events: signedEvents,
});

writeJson(path.join(outputDir, "root", "authorization-state.json"), {
  registrars: Object.fromEntries([registrarA, registrarB, registrarC].map((identity) => [
    identity.did,
    {
      status: "active",
      updated_at: createdAt,
      did_document_hash: identity.didDocumentHash,
      didDocumentSnapshot: identity.didDocument,
      authorizedDomains: identity.authorizedDomains,
    },
  ])),
  discovery_nodes: Object.fromEntries([discoveryA, discoveryB].map((identity) => [
    identity.did,
    {
      status: "active",
      updated_at: createdAt,
      did_document_hash: identity.didDocumentHash,
      didDocumentSnapshot: identity.didDocument,
      authorized_domains: identity.authorizedDomains,
      tag_tree_version: 1,
    },
  ])),
  vc_issuers: {},
});

writeJson(path.join(outputDir, "cdn", "manifest.json"), {
  version: "0.1.0",
  generatedAt: createdAt,
  rootDid: root.did,
  packages: [],
});

for (const [source, target] of [
  ["root-a.toml", "root/config.example.toml"],
  ["registrar-a.toml", "registrar-a/config.example.toml"],
  ["registrar-b.toml", "registrar-b/config.example.toml"],
  ["registrar-c.toml", "registrar-c/config.example.toml"],
  ["discovery-a.toml", "discovery-a/config.example.toml"],
  ["discovery-b.toml", "discovery-b/config.example.toml"],
  ["cdn.toml", "cdn/config.example.toml"],
]) {
  ensureDir(path.join(outputDir, path.dirname(target)));
  fs.copyFileSync(
    path.join(harnessRoot, "multi-registrar-discovery", "config", source),
    path.join(outputDir, target),
  );
}

for (const target of ["registrar-a/config.example.toml", "registrar-b/config.example.toml", "registrar-c/config.example.toml"]) {
  const targetPath = path.join(outputDir, target);
  const configText = fs
    .readFileSync(targetPath, "utf8")
    .replace(/root_did\s*=\s*"did:(?:ans|oan):AGRT:PLACEHOLDER"/, `root_did = "${root.did}"`);
  fs.writeFileSync(targetPath, withDatabaseSuffix(configText), "utf8");
}

{
  const targetPath = path.join(outputDir, "cdn/config.example.toml");
  const configText = fs
    .readFileSync(targetPath, "utf8")
    .replace(/root_did\s*=\s*"did:(?:ans|oan):AGRT:PLACEHOLDER"/, `root_did = "${root.did}"`);
  fs.writeFileSync(targetPath, withDatabaseSuffix(configText), "utf8");
}

{
  const rootConfigPath = path.join(outputDir, "root/config.example.toml");
  fs.writeFileSync(
    rootConfigPath,
    withDatabaseSuffix(fs.readFileSync(rootConfigPath, "utf8")),
    "utf8",
  );
}

for (const target of ["discovery-a/config.example.toml", "discovery-b/config.example.toml"]) {
  const targetPath = path.join(outputDir, target);
  fs.writeFileSync(
    targetPath,
    withDatabaseSuffix(fs.readFileSync(targetPath, "utf8")),
    "utf8",
  );
}

writeText(path.join(outputDir, "README.md"), [
  "# Multi Node Demo Data",
  "",
  "Generated by this experiment repository's `scripts/generate-local-topology.mjs`.",
  "It uses public OAN core configuration contracts and genesis identities from oan-design-docs.",
  "",
].join("\n"));

console.log(`Generated multi-node demo data at ${outputDir}`);



