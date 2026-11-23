import { lazy, Suspense } from 'react';
import { Experience } from './scene/Experience';
import { useAppStore } from './state/store';
import { useProjectLoader } from './state/useProjectLoader';
import { ErrorScreen } from './ui/ErrorScreen';
import { FadeVeil } from './ui/FadeVeil';
import { LoadingScreen } from './ui/LoadingScreen';
import { Overlay } from './ui/Overlay';

// leva + helpers are split into their own chunk and only fetched with ?debug.
const DebugPanel = lazy(() => import('./debug/DebugPanel'));

export function App() {
  useProjectLoader();
  const project = useAppStore((s) => s.project);
  const error = useAppStore((s) => s.projectError);
  const debug = useAppStore((s) => s.debug);

  return (
    <div className="app">
      {project && <Experience key={project.id} project={project} />}
      <FadeVeil />
      {project && <Overlay project={project} />}
      <LoadingScreen />
      {error && <ErrorScreen message={error} />}
      {debug && project && (
        <Suspense fallback={null}>
          <DebugPanel key={project.id} project={project} />
        </Suspense>
      )}
    </div>
  );
}
