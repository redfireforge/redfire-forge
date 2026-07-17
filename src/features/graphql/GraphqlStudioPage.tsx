import type { GraphqlStudioPageProps } from './graphqlStudioPageTypes';
import { GraphqlStudioPageBody } from './components/GraphqlStudioPageBody';
import { useGraphqlStudioPageComposition } from './hooks/useGraphqlStudioPageComposition';
import '../../styles/graphql-studio.css';
import '../../styles/graphql-tls-panel.css';
import '../../styles/graphql-collections.css';
import './utils/gqlModalLockHost';

export function GraphqlStudioPage(props: GraphqlStudioPageProps) {
  const { isReady, bodyProps } = useGraphqlStudioPageComposition(props);
  if (!isReady || !bodyProps) return null;
  return <GraphqlStudioPageBody {...bodyProps} />;
}
