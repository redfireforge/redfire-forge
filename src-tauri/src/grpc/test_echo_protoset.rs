//! Valid echo protoset fixture for Phase 7C tests.
//!
//! Generated from `docker/grpc/proto/echo.proto` via the Node `encodeRootAsProtosetBase64`
//! helper (protobufjs FileDescriptorSet). Keep in sync if echo.proto changes.

pub const ECHO_PROTOSET_BASE64: &str = "CsYDCgplY2hvLnByb3RvEgRlY2hvIh4KC0VjaG9SZXF1ZXN0Eg8KB21lc3NhZ2UYASABKAkiHwoMRWNob1Jlc3BvbnNlEg8KB21lc3NhZ2UYASABKAkiZAoNU3RyZWFtUmVxdWVzdBIPCgdtZXNzYWdlGAEgASgJEiEKDHJlcGVhdF9jb3VudBgCIAEoBVILcmVwZWF0Q291bnQSHwoLaW50ZXJ2YWxfbXMYAyABKAVSCmludGVydmFsTXMy6QEKC0VjaG9TZXJ2aWNlEi0KBEVjaG8SES5lY2hvLkVjaG9SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2USOQoMU2VydmVyU3RyZWFtEhMuZWNoby5TdHJlYW1SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2UwARI3CgxDbGllbnRTdHJlYW0SES5lY2hvLkVjaG9SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2UoARI3CgpCaWRpU3RyZWFtEhEuZWNoby5FY2hvUmVxdWVzdBoSLmVjaG8uRWNob1Jlc3BvbnNlKAEwAUIXWhVncnBjLXRlc3Qtc2VydmVyL2VjaG9iBnByb3RvMw==";

pub const ECHO_PROTOSET_SHA256: &str =
    "ad9f5cd347baa8428b69b0313edd2da0384d2eb571aa7b29fc3e48a90d168bae";

pub fn echo_descriptor_payload() -> crate::grpc::types::GrpcTauriDescriptorPayload {
    crate::grpc::types::GrpcTauriDescriptorPayload {
        descriptor_key: "test:echo".to_string(),
        protoset_base64: ECHO_PROTOSET_BASE64.to_string(),
        content_sha256: ECHO_PROTOSET_SHA256.to_string(),
    }
}
