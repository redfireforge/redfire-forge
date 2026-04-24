import { useContext } from 'react';
import { ToastContext, type ToastApi } from '../components/workflow/WorkflowToastProvider';

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within WorkflowToastProvider');
  return ctx;
}
