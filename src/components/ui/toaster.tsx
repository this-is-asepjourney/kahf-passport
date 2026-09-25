'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose?: () => void;
}

// Simple toast store
let listeners: Array<(toasts: ToastData[]) => void> = [];
let toasts: ToastData[] = [];

interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function notify() {
  listeners.forEach(l => l([...toasts]));
}

export function toast(message: string, type: ToastData['type'] = 'info') {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, 4000);
}

export function Toaster() {
  const [items, setItems] = React.useState<ToastData[]>([]);

  React.useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter(l => l !== setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2 max-w-md mx-auto pointer-events-none">
      {items.map(item => (
        <div
          key={item.id}
          className={cn(
            'px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-up pointer-events-auto',
            item.type === 'success' && 'bg-green-600 text-white',
            item.type === 'error' && 'bg-red-600 text-white',
            item.type === 'info' && 'bg-gray-900 text-white'
          )}
        >
          {item.type === 'success' && '✓ '}
          {item.type === 'error' && '✕ '}
          {item.message}
        </div>
      ))}
    </div>
  );
}
