'use client';

import * as Toast from '@radix-ui/react-toast';
import { useState, createContext, useContext, useCallback } from 'react';

type ToastData = { id: string; title: string; description?: string; variant?: 'default' | 'error' };

type ToastContextValue = {
  toast: (data: Omit<ToastData, 'id'>) => void;
};

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toast = useCallback((data: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...data, id }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toast.Provider swipeDirection="right">
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            className={`rounded-lg border px-4 py-3 shadow-md flex flex-col gap-1 bg-white data-[state=open]:animate-in data-[state=closed]:animate-out ${
              t.variant === 'error' ? 'border-red-200' : 'border-gray-200'
            }`}
            onOpenChange={(open) => {
              if (!open) setToasts((prev) => prev.filter((x) => x.id !== t.id));
            }}
            defaultOpen
          >
            <Toast.Title className="text-sm font-semibold text-gray-900">{t.title}</Toast.Title>
            {t.description && (
              <Toast.Description className="text-xs text-gray-500">{t.description}</Toast.Description>
            )}
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 w-80 z-50" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
