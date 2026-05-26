import { useEffect } from 'react';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store/useStore';

/**
 * Registers system-wide shortcuts that work even when the app is not focused.
 * Call this once in the main App component.
 *
 * CmdOrCtrl+Shift+H — toggle floating widget
 * CmdOrCtrl+Shift+D — complete current active task
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    let registered = false;

    (async () => {
      try {
        await register('CmdOrCtrl+Shift+H', () => {
          invoke('open_floating_widget').catch(console.error);
        });

        await register('CmdOrCtrl+Shift+D', () => {
          const { tasks, updateTaskStatus } = useStore.getState();
          const active = tasks.find((t) => t.status === 'active');
          if (active) {
            updateTaskStatus(active.id, 'done').catch(console.error);
          }
        });

        registered = true;
      } catch (err) {
        // Global shortcuts may fail in dev or when permission is denied; not fatal
        console.warn('[shortcuts] Failed to register global shortcuts:', err);
      }
    })();

    return () => {
      if (registered) {
        unregisterAll().catch(console.error);
      }
    };
  }, []);
}
