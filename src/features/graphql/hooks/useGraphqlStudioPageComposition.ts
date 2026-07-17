/**
 * useGraphqlStudioPageComposition — thin orchestrator wiring GraphQL Studio layer hooks.
 */
import type { GraphqlStudioPageProps } from '../graphqlStudioPageTypes';
import type { GraphqlStudioPageBodyProps } from '../components/GraphqlStudioPageBody';
import { useGraphqlStudioPageFoundation } from './useGraphqlStudioPageFoundation';
import { useGraphqlStudioPageTabsLayer } from './useGraphqlStudioPageTabsLayer';
import { useGraphqlStudioPageExecutionLayer } from './useGraphqlStudioPageExecutionLayer';
import { useGraphqlStudioPageInteractionLayer } from './useGraphqlStudioPageInteractionLayer';
import { buildGraphqlStudioPageBodyProps } from './buildGraphqlStudioPageBodyProps';

export interface GraphqlStudioPageComposition {
  isReady: boolean;
  bodyProps: GraphqlStudioPageBodyProps | null;
}

export function useGraphqlStudioPageComposition(props: GraphqlStudioPageProps): GraphqlStudioPageComposition {
  const foundation = useGraphqlStudioPageFoundation(props);
  const tabsLayer = useGraphqlStudioPageTabsLayer(foundation, props);
  const executionLayer = useGraphqlStudioPageExecutionLayer(foundation, tabsLayer, props.globalAuthProfiles);
  const interactionLayer = useGraphqlStudioPageInteractionLayer(
    foundation,
    tabsLayer,
    executionLayer,
    props.globalAuthProfiles,
  );

  const isReady = tabsLayer.tabs.length > 0 && Boolean(tabsLayer.activeTab);

  if (!isReady || !tabsLayer.activeTab || !tabsLayer.activeTabId) {
    return { isReady: false, bodyProps: null };
  }

  const bodyProps = buildGraphqlStudioPageBodyProps({
    foundation,
    tabsLayer,
    executionLayer,
    interactionLayer,
    globalAuthProfiles: props.globalAuthProfiles,
  });

  return { isReady, bodyProps };
}
