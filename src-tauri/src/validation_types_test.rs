#[cfg(test)]
mod tests {
    use crate::validation_types::*;
    use serde_json::json;

    // ── Assertion serde round-trip ──────────────────────────

    #[test]
    fn assertion_status_serde() {
        let js = json!({"type": "status", "negate": false, "expected": "200"});
        let a: Assertion = serde_json::from_value(js.clone()).unwrap();
        match &a {
            Assertion::Status { negate, expected } => {
                assert!(!negate);
                assert_eq!(expected, "200");
            }
            _ => panic!("expected Status"),
        }
        let rt = serde_json::to_value(&a).unwrap();
        assert_eq!(rt["type"], "status");
        assert_eq!(rt["expected"], "200");
    }

    #[test]
    fn assertion_response_time_serde() {
        let js = json!({"type": "responseTime", "maxMs": 500.0});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::ResponseTime { negate, max_ms } => {
                assert!(!negate);
                assert!((max_ms - 500.0).abs() < f64::EPSILON);
            }
            _ => panic!("expected ResponseTime"),
        }
    }

    #[test]
    fn assertion_header_serde() {
        let js = json!({"type": "header", "name": "Content-Type", "operator": "contains", "value": "json"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Header { operator, name, value, .. } => {
                assert_eq!(*operator, AssertionOperator::Contains);
                assert_eq!(name, "Content-Type");
                assert_eq!(value.as_deref(), Some("json"));
            }
            _ => panic!("expected Header"),
        }
    }

    #[test]
    fn assertion_regex_serde() {
        let js = json!({"type": "regex", "jsonPath": "$.name", "pattern": "^A.*"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Regex { json_path, pattern, .. } => {
                assert_eq!(json_path, "$.name");
                assert_eq!(pattern, "^A.*");
            }
            _ => panic!("expected Regex"),
        }
    }

    #[test]
    fn assertion_array_length_serde() {
        let js = json!({"type": "arrayLength", "jsonPath": "$.items", "operator": ">", "value": 5.0});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::ArrayLength { operator, value, .. } => {
                assert_eq!(*operator, ComparisonOperator::Gt);
                assert!((value - 5.0).abs() < f64::EPSILON);
            }
            _ => panic!("expected ArrayLength"),
        }
    }

    #[test]
    fn assertion_numeric_serde() {
        let js = json!({"type": "numeric", "jsonPath": "$.price", "operator": ">=", "value": 10.0});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Numeric { operator, .. } => {
                assert_eq!(*operator, ComparisonOperator::Gte);
            }
            _ => panic!("expected Numeric"),
        }
    }

    #[test]
    fn assertion_date_serde() {
        let js = json!({
            "type": "date", "jsonPath": "$.created",
            "operator": ">=",
            "reference": {"kind": "today", "timezone": "utc"}
        });
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Date { reference, .. } => {
                if let DateReference::Today { timezone } = reference {
                    assert_eq!(*timezone, Timezone::Utc);
                } else {
                    panic!("expected Today");
                }
            }
            _ => panic!("expected Date"),
        }
    }

    #[test]
    fn assertion_date_fixed_serde() {
        let js = json!({
            "type": "date", "jsonPath": "$.created",
            "operator": "=",
            "reference": {"kind": "fixed", "iso": "2024-01-15"}
        });
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Date { reference, .. } => {
                if let DateReference::Fixed { iso } = reference {
                    assert_eq!(iso, "2024-01-15");
                } else {
                    panic!("expected Fixed");
                }
            }
            _ => panic!("expected Date"),
        }
    }

    #[test]
    fn assertion_type_check_serde() {
        let js = json!({"type": "typeCheck", "jsonPath": "$.id", "expectedType": "number"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::TypeCheck { expected_type, .. } => {
                assert_eq!(*expected_type, JsonTypeName::Number);
            }
            _ => panic!("expected TypeCheck"),
        }
    }

    #[test]
    fn assertion_existence_serde() {
        let js = json!({"type": "existence", "jsonPath": "$.x", "expectExists": true});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Existence { expect_exists, .. } => {
                assert!(*expect_exists);
            }
            _ => panic!("expected Existence"),
        }
    }

    #[test]
    fn assertion_array_contains_serde() {
        let js = json!({"type": "arrayContains", "jsonPath": "$.tags", "value": "\"a\"", "mode": "any"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::ArrayContains { mode, .. } => {
                assert_eq!(*mode, ArrayContainsMode::Any);
            }
            _ => panic!("expected ArrayContains"),
        }
    }

    #[test]
    fn assertion_each_serde() {
        let js = json!({"type": "each", "jsonPath": "$.items", "fieldPath": "price", "operator": "greater_than", "value": "0"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Each { operator, .. } => {
                assert_eq!(*operator, FieldOperator::GreaterThan);
            }
            _ => panic!("expected Each"),
        }
    }

    #[test]
    fn assertion_contains_subset_serde() {
        let js = json!({"type": "containsSubset", "jsonPath": "$.data", "expected": "{\"a\":1}"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::ContainsSubset { expected, .. } => {
                assert_eq!(expected, "{\"a\":1}");
            }
            _ => panic!("expected ContainsSubset"),
        }
    }

    #[test]
    fn assertion_json_schema_serde() {
        let js = json!({"type": "jsonSchema", "schema": "{\"type\":\"object\"}"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::JsonSchema { schema, .. } => {
                assert_eq!(schema, "{\"type\":\"object\"}");
            }
            _ => panic!("expected JsonSchema"),
        }
    }

    #[test]
    fn assertion_body_size_serde() {
        let js = json!({"type": "bodySize", "operator": "<", "value": 1024.0, "unit": "kb"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::BodySize { operator, unit, .. } => {
                assert_eq!(*operator, ComparisonOperator::Lt);
                assert_eq!(*unit, SizeUnit::Kb);
            }
            _ => panic!("expected BodySize"),
        }
    }

    #[test]
    fn assertion_date_precise_serde() {
        let js = json!({
            "type": "datePrecise", "jsonPath": "$.ts",
            "operator": "!=", "reference": "2024-01-15T10:30:00Z", "precision": "hour"
        });
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::DatePrecise { precision, operator, .. } => {
                assert_eq!(*precision, DatePrecision::Hour);
                assert_eq!(*operator, ComparisonOperator::Ne);
            }
            _ => panic!("expected DatePrecise"),
        }
    }

    #[test]
    fn assertion_custom_serde() {
        let js = json!({"type": "custom", "expression": "$.status === 200", "description": "check status"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Custom { expression, description, .. } => {
                assert_eq!(expression, "$.status === 200");
                assert_eq!(description.as_deref(), Some("check status"));
            }
            _ => panic!("expected Custom"),
        }
    }

    #[test]
    fn assertion_negate_defaults_to_false() {
        let js = json!({"type": "status", "expected": "200"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        assert!(!a.is_negated());
    }

    #[test]
    fn assertion_negate_true() {
        let js = json!({"type": "status", "expected": "200", "negate": true});
        let a: Assertion = serde_json::from_value(js).unwrap();
        assert!(a.is_negated());
    }

    // ── FieldOperator serde ────────────────────────────────

    #[test]
    fn field_operator_snake_case_serde() {
        let ops = vec![
            ("\"equals\"", FieldOperator::Equals),
            ("\"not_equals\"", FieldOperator::NotEquals),
            ("\"greater_than\"", FieldOperator::GreaterThan),
            ("\"greater_than_or_equal\"", FieldOperator::GreaterThanOrEqual),
            ("\"less_than\"", FieldOperator::LessThan),
            ("\"less_than_or_equal\"", FieldOperator::LessThanOrEqual),
            ("\"contains\"", FieldOperator::Contains),
            ("\"not_contains\"", FieldOperator::NotContains),
            ("\"starts_with\"", FieldOperator::StartsWith),
            ("\"ends_with\"", FieldOperator::EndsWith),
            ("\"regex\"", FieldOperator::Regex),
            ("\"is_true\"", FieldOperator::IsTrue),
            ("\"is_false\"", FieldOperator::IsFalse),
            ("\"is_null\"", FieldOperator::IsNull),
            ("\"is_not_null\"", FieldOperator::IsNotNull),
            ("\"is_empty\"", FieldOperator::IsEmpty),
            ("\"is_not_empty\"", FieldOperator::IsNotEmpty),
            ("\"exists\"", FieldOperator::Exists),
            ("\"not_exists\"", FieldOperator::NotExists),
            ("\"is_type\"", FieldOperator::IsType),
            ("\"in\"", FieldOperator::In),
            ("\"not_in\"", FieldOperator::NotIn),
            ("\"between\"", FieldOperator::Between),
            ("\"close_to\"", FieldOperator::CloseTo),
        ];
        for (json_str, expected) in ops {
            let deser: FieldOperator = serde_json::from_str(json_str).unwrap();
            assert_eq!(deser, expected, "deserialize {}", json_str);
            let ser = serde_json::to_string(&expected).unwrap();
            assert_eq!(ser, json_str, "serialize {:?}", expected);
        }
    }

    // ── ComparisonOperator serde ───────────────────────────

    #[test]
    fn comparison_operator_serde() {
        let ops = vec![
            ("\"=\"", ComparisonOperator::Eq),
            ("\"!=\"", ComparisonOperator::Ne),
            ("\">\"", ComparisonOperator::Gt),
            ("\">=\"", ComparisonOperator::Gte),
            ("\"<\"", ComparisonOperator::Lt),
            ("\"<=\"", ComparisonOperator::Lte),
        ];
        for (json_str, expected) in ops {
            let deser: ComparisonOperator = serde_json::from_str(json_str).unwrap();
            assert_eq!(deser, expected, "deserialize {}", json_str);
            let ser = serde_json::to_string(&expected).unwrap();
            assert_eq!(ser, json_str, "serialize {:?}", expected);
        }
    }

    // ── ValidationConfig serde ─────────────────────────────

    #[test]
    fn validation_config_none_mode() {
        let js = json!({"mode": "none"});
        let vc: ValidationConfig = serde_json::from_value(js).unwrap();
        assert_eq!(vc.mode, ValidationMode::None);
        assert!(vc.expected_json.is_none());
    }

    #[test]
    fn validation_config_full_mode() {
        let js = json!({"mode": "full", "expectedJson": "{\"a\":1}"});
        let vc: ValidationConfig = serde_json::from_value(js).unwrap();
        assert_eq!(vc.mode, ValidationMode::Full);
        assert_eq!(vc.expected_json.as_deref(), Some("{\"a\":1}"));
    }

    #[test]
    fn validation_config_selective_with_fields() {
        let js = json!({
            "mode": "selective",
            "expectedFields": [
                {"jsonPath": "$.name", "expectedValue": "Alice", "operator": "equals", "negate": false}
            ],
            "unorderedArrays": true
        });
        let vc: ValidationConfig = serde_json::from_value(js).unwrap();
        assert_eq!(vc.mode, ValidationMode::Selective);
        let fields = vc.expected_fields.unwrap();
        assert_eq!(fields.len(), 1);
        assert_eq!(fields[0].json_path, "$.name");
        assert_eq!(fields[0].operator, Some(FieldOperator::Equals));
        assert_eq!(vc.unordered_arrays, Some(true));
    }

    // ── ExpectedField serde ────────────────────────────────

    #[test]
    fn expected_field_minimal() {
        let js = json!({"jsonPath": "$.id", "expectedValue": "123"});
        let f: ExpectedField = serde_json::from_value(js).unwrap();
        assert_eq!(f.json_path, "$.id");
        assert_eq!(f.expected_value, "123");
        assert!(f.operator.is_none());
        assert!(f.operator_value.is_none());
        assert!(f.negate.is_none());
        assert!(f.expression.is_none());
    }

    #[test]
    fn expected_field_full() {
        let js = json!({
            "jsonPath": "$.price",
            "expectedValue": "10",
            "operator": "greater_than",
            "operatorValue": "5",
            "negate": true,
            "expression": "$maxBy(...)"
        });
        let f: ExpectedField = serde_json::from_value(js).unwrap();
        assert_eq!(f.operator, Some(FieldOperator::GreaterThan));
        assert_eq!(f.operator_value.as_deref(), Some("5"));
        assert_eq!(f.negate, Some(true));
        assert_eq!(f.expression.as_deref(), Some("$maxBy(...)"));
    }

    // ── Enum serialization edge cases ──────────────────────

    #[test]
    fn validation_mode_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&ValidationMode::None).unwrap(), "\"none\"");
        assert_eq!(serde_json::to_string(&ValidationMode::Full).unwrap(), "\"full\"");
        assert_eq!(serde_json::to_string(&ValidationMode::Selective).unwrap(), "\"selective\"");
        let rt: ValidationMode = serde_json::from_str("\"none\"").unwrap();
        assert_eq!(rt, ValidationMode::None);
    }

    #[test]
    fn array_contains_mode_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&ArrayContainsMode::None).unwrap(), "\"none\"");
        assert_eq!(serde_json::to_string(&ArrayContainsMode::Any).unwrap(), "\"any\"");
        assert_eq!(serde_json::to_string(&ArrayContainsMode::All).unwrap(), "\"all\"");
        assert_eq!(serde_json::to_string(&ArrayContainsMode::Only).unwrap(), "\"only\"");
    }

    #[test]
    fn json_type_name_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&JsonTypeName::String).unwrap(), "\"string\"");
        assert_eq!(serde_json::to_string(&JsonTypeName::Number).unwrap(), "\"number\"");
        assert_eq!(serde_json::to_string(&JsonTypeName::Boolean).unwrap(), "\"boolean\"");
        assert_eq!(serde_json::to_string(&JsonTypeName::Array).unwrap(), "\"array\"");
        assert_eq!(serde_json::to_string(&JsonTypeName::Object).unwrap(), "\"object\"");
        assert_eq!(serde_json::to_string(&JsonTypeName::Null).unwrap(), "\"null\"");
    }

    #[test]
    fn size_unit_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&SizeUnit::Bytes).unwrap(), "\"bytes\"");
        assert_eq!(serde_json::to_string(&SizeUnit::Kb).unwrap(), "\"kb\"");
        assert_eq!(serde_json::to_string(&SizeUnit::Mb).unwrap(), "\"mb\"");
    }

    #[test]
    fn date_precision_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&DatePrecision::Day).unwrap(), "\"day\"");
        assert_eq!(serde_json::to_string(&DatePrecision::Millisecond).unwrap(), "\"millisecond\"");
    }

    #[test]
    fn assertion_operator_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&AssertionOperator::Equals).unwrap(), "\"equals\"");
        assert_eq!(serde_json::to_string(&AssertionOperator::Contains).unwrap(), "\"contains\"");
        assert_eq!(serde_json::to_string(&AssertionOperator::Regex).unwrap(), "\"regex\"");
        assert_eq!(serde_json::to_string(&AssertionOperator::Exists).unwrap(), "\"exists\"");
    }

    #[test]
    fn timezone_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&Timezone::Utc).unwrap(), "\"utc\"");
        assert_eq!(serde_json::to_string(&Timezone::Local).unwrap(), "\"local\"");
    }

    // ── FailureDetail serde ────────────────────────────────

    #[test]
    fn failure_detail_serde() {
        let fd = FailureDetail {
            path: "(status)".into(),
            expected: "200".into(),
            actual: "500".into(),
        };
        let js = serde_json::to_value(&fd).unwrap();
        assert_eq!(js["path"], "(status)");
        let rt: FailureDetail = serde_json::from_value(js).unwrap();
        assert_eq!(rt, fd);
    }

    // ── Full 16-assertion array from JS ────────────────────

    #[test]
    fn deserialize_all_16_assertion_types_from_js_array() {
        let js_payload = json!([
            {"type": "status", "expected": "200"},
            {"type": "responseTime", "maxMs": 500},
            {"type": "header", "name": "X-Rate", "operator": "exists"},
            {"type": "regex", "jsonPath": "$.name", "pattern": "^Al"},
            {"type": "arrayLength", "jsonPath": "$.items", "operator": ">", "value": 0},
            {"type": "numeric", "jsonPath": "$.price", "operator": "<=", "value": 99.99},
            {"type": "date", "jsonPath": "$.created", "operator": ">=", "reference": {"kind": "today", "timezone": "local"}},
            {"type": "typeCheck", "jsonPath": "$.id", "expectedType": "string"},
            {"type": "existence", "jsonPath": "$.token", "expectExists": true},
            {"type": "arrayContains", "jsonPath": "$.tags", "value": "\"admin\"", "mode": "any"},
            {"type": "each", "jsonPath": "$.items", "fieldPath": "qty", "operator": "greater_than", "value": "0"},
            {"type": "containsSubset", "jsonPath": "$.data", "expected": "{\"active\":true}"},
            {"type": "jsonSchema", "schema": "{\"type\":\"object\",\"required\":[\"id\"]}"},
            {"type": "bodySize", "operator": "<", "value": 10240, "unit": "bytes"},
            {"type": "datePrecise", "jsonPath": "$.ts", "operator": "=", "reference": "2024-06-01T00:00:00Z", "precision": "day"},
            {"type": "custom", "negate": true, "expression": "$.body.count > 0", "description": "has items"}
        ]);

        let assertions: Vec<Assertion> = serde_json::from_value(js_payload).unwrap();
        assert_eq!(assertions.len(), 16);

        assert!(matches!(&assertions[0], Assertion::Status { expected, .. } if expected == "200"));
        assert!(matches!(&assertions[1], Assertion::ResponseTime { max_ms, .. } if (*max_ms - 500.0).abs() < f64::EPSILON));
        assert!(matches!(&assertions[2], Assertion::Header { operator, .. } if *operator == AssertionOperator::Exists));
        assert!(matches!(&assertions[3], Assertion::Regex { pattern, .. } if pattern == "^Al"));
        assert!(matches!(&assertions[4], Assertion::ArrayLength { operator, .. } if *operator == ComparisonOperator::Gt));
        assert!(matches!(&assertions[5], Assertion::Numeric { operator, value, .. } if *operator == ComparisonOperator::Lte && (*value - 99.99).abs() < 0.001));
        assert!(matches!(&assertions[6], Assertion::Date { reference: DateReference::Today { timezone: Timezone::Local }, .. }));
        assert!(matches!(&assertions[7], Assertion::TypeCheck { expected_type, .. } if *expected_type == JsonTypeName::String));
        assert!(matches!(&assertions[8], Assertion::Existence { expect_exists, .. } if *expect_exists));
        assert!(matches!(&assertions[9], Assertion::ArrayContains { mode, .. } if *mode == ArrayContainsMode::Any));
        assert!(matches!(&assertions[10], Assertion::Each { operator, .. } if *operator == FieldOperator::GreaterThan));
        assert!(matches!(&assertions[11], Assertion::ContainsSubset { .. }));
        assert!(matches!(&assertions[12], Assertion::JsonSchema { .. }));
        assert!(matches!(&assertions[13], Assertion::BodySize { unit, .. } if *unit == SizeUnit::Bytes));
        assert!(matches!(&assertions[14], Assertion::DatePrecise { precision, .. } if *precision == DatePrecision::Day));
        assert!(matches!(&assertions[15], Assertion::Custom { negate, .. } if *negate));
    }

    #[test]
    fn assertion_header_with_null_value() {
        let js = json!({"type": "header", "name": "X-Rate", "operator": "exists", "value": null});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Header { value, .. } => assert!(value.is_none()),
            _ => panic!("expected Header"),
        }
    }

    #[test]
    fn assertion_each_without_value() {
        let js = json!({"type": "each", "jsonPath": "$.items", "fieldPath": "active", "operator": "is_true"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Each { value, operator, .. } => {
                assert!(value.is_none());
                assert_eq!(*operator, FieldOperator::IsTrue);
            }
            _ => panic!("expected Each"),
        }
    }

    #[test]
    fn assertion_custom_without_description() {
        let js = json!({"type": "custom", "expression": "true"});
        let a: Assertion = serde_json::from_value(js).unwrap();
        match &a {
            Assertion::Custom { description, .. } => assert!(description.is_none()),
            _ => panic!("expected Custom"),
        }
    }

    // ── ValidationConfig + assertions full round-trip ──────

    #[test]
    fn validation_config_with_assertions_roundtrip() {
        let js = json!({
            "mode": "selective",
            "expectedFields": [
                {"jsonPath": "$.name", "expectedValue": "test"},
                {"jsonPath": "$.count", "expectedValue": "5", "operator": "greater_than_or_equal", "negate": true}
            ],
            "unorderedArrays": false
        });
        let vc: ValidationConfig = serde_json::from_value(js.clone()).unwrap();
        assert_eq!(vc.mode, ValidationMode::Selective);

        let fields = vc.expected_fields.as_ref().unwrap();
        assert_eq!(fields.len(), 2);
        assert_eq!(fields[1].operator, Some(FieldOperator::GreaterThanOrEqual));
        assert_eq!(fields[1].negate, Some(true));

        let roundtrip = serde_json::to_value(&vc).unwrap();
        assert_eq!(roundtrip["mode"], "selective");
        assert_eq!(roundtrip["unorderedArrays"], false);
    }

    #[test]
    fn validation_config_minimal_json_deserializes() {
        // Minimal JSON from JS — only mode is required, all other fields are optional
        let js = json!({"mode": "none"});
        let result: Result<ValidationConfig, _> = serde_json::from_value(js);
        assert!(result.is_ok(), "Minimal ValidationConfig should deserialize: {:?}", result.err());
        let vc = result.unwrap();
        assert_eq!(vc.mode, ValidationMode::None);
        assert!(vc.expected_json.is_none());
        assert!(vc.expected_fields.is_none());
        assert!(vc.unordered_arrays.is_none());
    }
}
