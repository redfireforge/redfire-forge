/**
 * Phase 3C — bundled Google Well-Known Types and minimal google.api stubs for import resolution.
 * Paths use canonical proto import strings (e.g. `google/protobuf/timestamp.proto`).
 */

export const PROTO_WKT_BUNDLE: Readonly<Record<string, string>> = {
  'google/protobuf/timestamp.proto': `syntax = "proto3";
package google.protobuf;
message Timestamp {
  int64 seconds = 1;
  int32 nanos = 2;
}`,
  'google/protobuf/duration.proto': `syntax = "proto3";
package google.protobuf;
message Duration {
  int64 seconds = 1;
  int32 nanos = 2;
}`,
  'google/protobuf/empty.proto': `syntax = "proto3";
package google.protobuf;
message Empty {}`,
  'google/protobuf/wrappers.proto': `syntax = "proto3";
package google.protobuf;
message DoubleValue { double value = 1; }
message FloatValue { float value = 1; }
message Int64Value { int64 value = 1; }
message UInt64Value { uint64 value = 1; }
message Int32Value { int32 value = 1; }
message UInt32Value { uint32 value = 1; }
message BoolValue { bool value = 1; }
message StringValue { string value = 1; }
message BytesValue { bytes value = 1; }`,
  'google/protobuf/struct.proto': `syntax = "proto3";
package google.protobuf;
message Struct { map<string, Value> fields = 1; }
message Value {
  oneof kind {
    NullValue null_value = 1;
    double number_value = 2;
    string string_value = 3;
    bool bool_value = 4;
    Struct struct_value = 5;
    ListValue list_value = 6;
  }
}
message ListValue { repeated Value values = 1; }
enum NullValue { NULL_VALUE = 0; }`,
  'google/protobuf/any.proto': `syntax = "proto3";
package google.protobuf;
message Any {
  string type_url = 1;
  bytes value = 2;
}`,
  'google/protobuf/field_mask.proto': `syntax = "proto3";
package google.protobuf;
message FieldMask { repeated string paths = 1; }`,
  'google/api/annotations.proto': `syntax = "proto3";
package google.api;
import "google/protobuf/descriptor.proto";
extend google.protobuf.MethodOptions {
  HttpRule http = 72295728;
}
message HttpRule {
  string selector = 1;
  oneof pattern {
    string get = 2;
    string put = 3;
    string post = 4;
    string delete = 5;
    string patch = 6;
  }
}`,
  'google/protobuf/descriptor.proto': `syntax = "proto2";
package google.protobuf;
message FileDescriptorSet { repeated FileDescriptorProto file = 1; }
message FileDescriptorProto {
  optional string name = 1;
  optional string package = 2;
  repeated DescriptorProto message_type = 4;
  repeated EnumDescriptorProto enum_type = 5;
  repeated ServiceDescriptorProto service = 6;
  repeated FieldDescriptorProto extension = 7;
  repeated string dependency = 10;
}
message DescriptorProto {
  optional string name = 1;
  repeated FieldDescriptorProto field = 2;
  repeated DescriptorProto nested_type = 3;
  repeated EnumDescriptorProto enum_type = 4;
  repeated string oneof_decl = 8;
}
message FieldDescriptorProto {
  optional string name = 1;
  optional int32 number = 3;
  optional Label label = 4;
  optional Type type = 5;
  optional string type_name = 6;
  optional string extendee = 7;
  enum Type {
    TYPE_DOUBLE = 1; TYPE_FLOAT = 2; TYPE_INT64 = 3; TYPE_UINT64 = 4;
    TYPE_INT32 = 5; TYPE_FIXED64 = 6; TYPE_FIXED32 = 7; TYPE_BOOL = 8;
    TYPE_STRING = 9; TYPE_GROUP = 10; TYPE_MESSAGE = 11; TYPE_BYTES = 12;
    TYPE_UINT32 = 13; TYPE_ENUM = 14; TYPE_SFIXED32 = 15; TYPE_SFIXED64 = 16;
    TYPE_SINT32 = 17; TYPE_SINT64 = 18;
  }
  enum Label { LABEL_OPTIONAL = 1; LABEL_REQUIRED = 2; LABEL_REPEATED = 3; }
}
message EnumDescriptorProto {
  optional string name = 1;
  repeated EnumValueDescriptorProto value = 2;
}
message EnumValueDescriptorProto {
  optional string name = 1;
  optional int32 number = 2;
}
message ServiceDescriptorProto {
  optional string name = 1;
  repeated MethodDescriptorProto method = 2;
}
message MethodDescriptorProto {
  optional string name = 1;
  optional string input_type = 2;
  optional string output_type = 3;
  optional MethodOptions options = 4;
}
message MethodOptions { repeated google.protobuf.UninterpretedOption uninterpreted_option = 999; }
message UninterpretedOption {
  repeated NamePart name = 2;
  optional string identifier_value = 3;
  optional uint64 positive_int_value = 4;
  optional int64 negative_int_value = 5;
  optional double double_value = 6;
  optional bytes string_value = 7;
  optional string aggregate_value = 8;
  message NamePart { required string name_part = 1; optional bool is_extension = 2; }
}`,
};

export function listBundledProtoPaths(): string[] {
  return Object.keys(PROTO_WKT_BUNDLE).sort((a, b) => a.localeCompare(b));
}
