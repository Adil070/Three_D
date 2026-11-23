import { useEffect } from 'react';
import { loadProject, projectIdFromHash } from '../config/loadProject';
import { useAppStore } from './store';

/** Loads the project named in the URL hash, and reloads when the hash changes. */
export function useProjectLoader(): void {
  useEffect(() => {
    let ac: AbortController | null = null;

    const load = () => {
      const id = projectIdFromHash();
      const { project, setLoading, setProject } = useAppStore.getState();
      if (project?.id === id) return;

      ac?.abort();
      const controller = new AbortController();
      ac = controller;
      setLoading('project', { label: 'Loading project', progress: null });

      loadProject(id, controller.signal)
        .then((p) => {
          if (controller.signal.aborted) return;
          document.title = p.config.project.name;
          setProject(p);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setProject(null, err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading('project', null);
        });
    };

    load();
    window.addEventListener('hashchange', load);
    return () => {
      window.removeEventListener('hashchange', load);
      ac?.abort();
    };
  }, []);
}
