export type ToastVariant = 'info' | 'success' | 'error' | 'loading';

export type ToastRecord = {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
};
