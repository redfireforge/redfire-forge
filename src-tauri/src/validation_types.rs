use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Validation Config (engine-relevant fields only) ─────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationConfig {
    pub mode: ValidationMode,
    pub expected_json: Option<String>,
    pub expected_fields: Option<Vec<ExpectedField>>,
    pub unordered_arrays: Option<bool>,
}

impl Default for ValidationConfig {
    fn default() -> Self {
        Self {
            mode: ValidationMode::None,
            expected_json: None,
            expected_fields: None,
            unordered_arrays: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ValidationMode {
    None,
    Full,
    Selective,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedField {
    pub json_path: String,
    pub expected_value: String,
    pub operator: Option<FieldOperator>,
    pub operator_value: Option<String>,
    pub negate: Option<bool>,
    pub expression: Option<String>,
}

// ── Field Operator (24 variants) ────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FieldOperator {
    Equals,
    NotEquals,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Contains,
    NotContains,
    StartsWith,
    EndsWith,
    Regex,
    IsTrue,
    IsFalse,
    IsNull,
    IsNotNull,
    IsEmpty,
    IsNotEmpty,
    Exists,
    NotExists,
    IsType,
    In,
    NotIn,
    Between,
    CloseTo,
}

// ── Assertion (tagged union — 16 variants) ──────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Assertion {
    Status {
        #[serde(default)]
        negate: bool,
        expected: String,
    },
    ResponseTime {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "maxMs")]
        max_ms: f64,
    },
    Header {
        #[serde(default)]
        negate: bool,
        name: String,
        operator: AssertionOperator,
        value: Option<String>,
    },
    Regex {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "jsonPath")]
        json_path: String,
        pattern: String,
    },
    ArrayLength {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "jsonPath")]
        json_path: String,
        operator: ComparisonOperator,
        value: f64,
    },
    Numeric {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "jsonPath")]
        json_path: String,
        operator: ComparisonOperator,
        value: f64,
    },
    Date {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "jsonPath")]
        json_path: String,
        operator: ComparisonOperator,
        reference: DateReference,
    },
    TypeCheck {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "jsonPath")]
        json_path: String,
        #[serde(rename = "expectedType")]
        expected_type: JsonTypeName,
    },
    Existence {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "jsonPath")]
        json_path: String,
        #[serde(rename = "expectExists")]
        expect_exists: bool,
    },
    ArrayContains {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "jsonPath")]
        json_path: String,
        value: String,
        mode: ArrayContainsMode,
    },
    Each {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "jsonPath")]
        json_path: String,
        #[serde(rename = "fieldPath")]
        field_path: String,
        operator: FieldOperator,
        value: Option<String>,
    },
    ContainsSubset {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "jsonPath")]
        json_path: String,
        expected: String,
    },
    JsonSchema {
        #[serde(default)]
        negate: bool,
        schema: String,
    },
    BodySize {
        #[serde(default)]
        negate: bool,
        operator: ComparisonOperator,
        value: f64,
        unit: SizeUnit,
    },
    DatePrecise {
        #[serde(default)]
        negate: bool,
        #[serde(rename = "jsonPath")]
        json_path: String,
        operator: ComparisonOperator,
        reference: String,
        precision: DatePrecision,
    },
    Custom {
        #[serde(default)]
        negate: bool,
        expression: String,
        description: Option<String>,
    },
}

impl Assertion {
    pub fn is_negated(&self) -> bool {
        match self {
            Self::Status { negate, .. }
            | Self::ResponseTime { negate, .. }
            | Self::Header { negate, .. }
            | Self::Regex { negate, .. }
            | Self::ArrayLength { negate, .. }
            | Self::Numeric { negate, .. }
            | Self::Date { negate, .. }
            | Self::TypeCheck { negate, .. }
            | Self::Existence { negate, .. }
            | Self::ArrayContains { negate, .. }
            | Self::Each { negate, .. }
            | Self::ContainsSubset { negate, .. }
            | Self::JsonSchema { negate, .. }
            | Self::BodySize { negate, .. }
            | Self::DatePrecise { negate, .. }
            | Self::Custom { negate, .. } => *negate,
        }
    }
}

// ── Supporting Enums ────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AssertionOperator {
    Equals,
    Contains,
    Regex,
    Exists,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ComparisonOperator {
    #[serde(rename = "=")]
    Eq,
    #[serde(rename = "!=")]
    Ne,
    #[serde(rename = ">")]
    Gt,
    #[serde(rename = ">=")]
    Gte,
    #[serde(rename = "<")]
    Lt,
    #[serde(rename = "<=")]
    Lte,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DateReference {
    Today {
        timezone: Timezone,
    },
    Fixed {
        iso: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Timezone {
    Utc,
    Local,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JsonTypeName {
    String,
    Number,
    Boolean,
    Array,
    Object,
    Null,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ArrayContainsMode {
    Any,
    All,
    Only,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SizeUnit {
    Bytes,
    Kb,
    Mb,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DatePrecision {
    Day,
    Hour,
    Minute,
    Second,
    Millisecond,
}

// ── Failure Detail ──────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailureDetail {
    pub path: String,
    pub expected: String,
    pub actual: String,
}

// ── Validation Output ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationOutput {
    pub passed: bool,
    pub failure_details: Vec<FailureDetail>,
    pub error_message: Option<String>,
}

// ── Assertion Context (for evaluate_assertions) ─────────────

pub struct AssertionContext<'a> {
    pub http_status: u16,
    pub response_time_ms: f64,
    pub response_headers: &'a HashMap<String, String>,
    pub response_body: &'a serde_json::Value,
    pub raw_body: &'a str,
}

// ── Assertion Evaluation Result ─────────────────────────────

pub struct AssertionEvalResult {
    pub failures: Vec<FailureDetail>,
    pub status_asserted: bool,
}
