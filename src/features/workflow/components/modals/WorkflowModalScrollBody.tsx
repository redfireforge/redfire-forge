import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function WorkflowModalScrollBody({ children, className, viewportClassName }: Props) {
  return (
    <div className={joinClasses('wf-modal-scroll-shell', className)}>
      <div className={joinClasses('wf-modal-scroll-viewport', viewportClassName)}>
        {children}
      </div>
    </div>
  );
}