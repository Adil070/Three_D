import { useAppStore } from '../state/store';

/** Full-screen loader shown while project.json or any splat is downloading. */
export function LoadingScreen() {
  const task = useAppStore((s) => Object.values(s.loading)[0] ?? null);
  const projectName = useAppStore((s) => s.project?.config.project.name);

  if (!task) return null;
  const pct = task.progress === null ? null : Math.round(task.progress * 100);

  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading__inner">
        {projectName && <p className="loading__project">{projectName}</p>}
        <p className="loading__label">
          {task.label}
          {pct !== null ? ` · ${pct}%` : '…'}
        </p>
        <div
          className={`loading__bar${pct === null ? ' loading__bar--indeterminate' : ''}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
        >
          <div className="loading__fill" style={pct === null ? undefined : { width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
