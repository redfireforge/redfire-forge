//! Native mock rule validation/evaluation (Phase 11M parity slice).

#![allow(dead_code)]

mod evaluation;
mod expression;
mod types;

#[cfg(test)]
mod tests;

pub use evaluation::{evaluate_grpc_mock_rule_set, validate_grpc_mock_rule_set};
pub use types::{
    GrpcMockEvaluationContext, GrpcMockRuleEvaluationResult, GrpcMockRuleResponse,
    GrpcMockRuleSet,
};
