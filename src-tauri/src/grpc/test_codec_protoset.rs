//! Representative protoset for Phase 7G codec acceptance (nested, repeated, oneof, timestamp-shaped message).
//!
//! Generated via protobufjs `root.toDescriptor` without bundled WKT files so prost-reflect can load it.

pub const CODEC_ACCEPTANCE_PROTOSET_BASE64: &str = "CpQDCgtjb2RlYy5wcm90bxIFY29kZWMiKwoJVGltZXN0YW1wEg8KB3NlY29uZHMYASABKAMSDQoFbmFub3MYAiABKAUiKgoKTmVzdGVkSXRlbRINCgVsYWJlbBgBIAEoCRINCgVjb3VudBgCIAEoBSKfAQoOQ29tcGxleFJlcXVlc3QSDAoEbmFtZRgBIAEoCRIMCgR0YWdzGAIgAygJEhoKBm5lc3RlZBgDIAEoCzIKTmVzdGVkSXRlbRIOCgR0ZXh0GAQgASgJSAASEAoGbnVtYmVyGAUgASgFSAASKAoKY3JlYXRlZF9hdBgGIAEoCzIJVGltZXN0YW1wUgljcmVhdGVkQXRCCQoHcGF5bG9hZCIvCg9Db21wbGV4UmVzcG9uc2USHAoEZWNobxgBIAEoCzIOQ29tcGxleFJlcXVlc3QySgoMQ29kZWNTZXJ2aWNlEjoKCVJvdW5kVHJpcBIVLmNvZGVjLkNvbXBsZXhSZXF1ZXN0GhYuY29kZWMuQ29tcGxleFJlc3BvbnNlYgZwcm90bzM=";

pub const CODEC_ACCEPTANCE_PROTOSET_SHA256: &str =
    "348cbe699419127297d2d9a5cd3392dd159f31c104f18c6103c4e35537a5f8fc";

pub fn codec_acceptance_descriptor_payload() -> crate::grpc::types::GrpcTauriDescriptorPayload {
    crate::grpc::types::GrpcTauriDescriptorPayload {
        descriptor_key: "test:codec-acceptance".to_string(),
        protoset_base64: CODEC_ACCEPTANCE_PROTOSET_BASE64.to_string(),
        content_sha256: CODEC_ACCEPTANCE_PROTOSET_SHA256.to_string(),
    }
}
