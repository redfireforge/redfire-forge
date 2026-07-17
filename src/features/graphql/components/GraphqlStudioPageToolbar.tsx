import type { GraphqlStudioPageToolbarSections } from '../utils/graphqlStudioPageToolbarProps';
import { GraphqlConnectionBar } from './GraphqlConnectionBar';
import { GraphqlAdvancedSettings } from './GraphqlAdvancedSettings';
import { GraphqlStudioPageDialogs } from './GraphqlStudioPageDialogs';

export function GraphqlStudioPageToolbar({
  connectionBar,
  advancedSettings,
  dialogs,
}: GraphqlStudioPageToolbarSections) {
  return (
    <>
      <GraphqlConnectionBar {...connectionBar} />
      <GraphqlAdvancedSettings {...advancedSettings} />
      <GraphqlStudioPageDialogs {...dialogs} />
    </>
  );
}
