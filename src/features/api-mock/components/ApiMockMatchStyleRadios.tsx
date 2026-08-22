import type { ApiMockPredicateV1 } from '../../../shared/api-mock/contracts';

interface Props {
  predicate: ApiMockPredicateV1;
  onUpdate: (id: string, patch: Partial<ApiMockPredicateV1>) => void;
}

export function ApiMockMatchStyleRadios({ predicate, onUpdate }: Props) {
  return <div className="am-matchstyle-radios" role="radiogroup" aria-label="How the resolved value is compared" data-testid={`api-mock-condition-matchstyle-${predicate.id}`}>
    <label className="am-matchstyle-radio"><input type="radio" name={`am-matchstyle-${predicate.id}`} checked={predicate.options?.matchStyle !== 'subset'} onChange={() => onUpdate(predicate.id, { options: { ...predicate.options, matchStyle: 'exact' } })} data-testid={`api-mock-condition-matchstyle-equals-${predicate.id}`} />Equals</label>
    <label className="am-matchstyle-radio"><input type="radio" name={`am-matchstyle-${predicate.id}`} checked={predicate.options?.matchStyle === 'subset'} onChange={() => onUpdate(predicate.id, { options: { ...predicate.options, matchStyle: 'subset' } })} data-testid={`api-mock-condition-matchstyle-contains-${predicate.id}`} />Contains</label>
  </div>;
}