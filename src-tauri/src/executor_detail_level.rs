use crate::types::{DetailLevel, ExecutionResult};

const SAMPLED_BATCH_CAP: usize = 10;

pub(crate) fn filter_batch(
    detail_level: &DetailLevel,
    batch: &mut Vec<ExecutionResult>,
) -> Vec<ExecutionResult> {
    match detail_level {
        DetailLevel::Full => std::mem::take(batch),
        DetailLevel::MetricsOnly => {
            batch.clear();
            vec![]
        }
        DetailLevel::Sampled => {
            let cap = batch.len().min(SAMPLED_BATCH_CAP);
            let sampled: Vec<ExecutionResult> = batch.drain(..cap).collect();
            batch.clear();
            sampled
        }
    }
}