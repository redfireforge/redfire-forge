import type { ComponentProps } from 'react';
import { ApiMockStudioActiveSection } from './ApiMockStudioActiveSection';

type Props = ComponentProps<typeof ApiMockStudioActiveSection>;

export function ApiMockStudioActivePanel(props: Props) {
  return <ApiMockStudioActiveSection {...props} />;
}
