'use client';

import { createContext, useRef } from 'react';
import { Toast } from '@base-ui/react/toast';
import { ToastViewport, ToastRoot, ToastTitle, ToastDescription } from '@/components/ui/toast';

interface ToastOptions {
  title?: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  timeout?: number;
}

interface ToastContextType {
  toast: (options: ToastOptions) => string;
  dismiss: (id?: string) => void;
}

export const ToastContext = createContext<ToastContextType>({
  toast: () => '',
  dismiss: () => {},
});

function ToastList() {
  const manager = Toast.useToastManager();

  return (
    <ToastViewport>
      {manager.toasts.map((t) => (
        <ToastRoot key={t.id} type={t.type}>
          {t.title ? <ToastTitle>{t.title}</ToastTitle> : null}
          {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
        </ToastRoot>
      ))}
    </ToastViewport>
  );
}

function ToastManagerProvider({ children }: { children: React.ReactNode }) {
  const manager = Toast.useToastManager();

  const contextValue = useRef<ToastContextType>({
    toast: (options: ToastOptions) => {
      return manager.add({
        title: options.title,
        description: options.description,
        type: options.type || 'info',
        timeout: options.timeout ?? 4000,
      });
    },
    dismiss: (id?: string) => {
      manager.close(id);
    },
  }).current;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastList />
    </ToastContext.Provider>
  );
}

export default function ToastContextProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider timeout={4000} limit={5}>
      <ToastManagerProvider>{children}</ToastManagerProvider>
    </Toast.Provider>
  );
}
