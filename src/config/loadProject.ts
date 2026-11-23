import { z } from 'zod';
import { ProjectFileSchema, type ProjectFile, type Unit } from './schema';

export interface LoadedProject {
  id: string;
  /** Absolute URL of the project folder, ending in '/'. */
  baseUrl: string;
  config: ProjectFile;
}

const PROJECT_ID_RE = /^[a-z0-9_-]+$/i;
export const DEFAULT_PROJECT_ID = 'demo-project';

/** Reads the project id from the URL hash (`#demo-project`, also `#demo-project?debug`). */
export function projectIdFromHash(hash: string = window.location.hash): string {
  const raw = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const id = decodeURIComponent(raw).trim();
  return id === '' ? DEFAULT_PROJECT_ID : id;
}

export function projectBaseUrl(projectId: string): string {
  return new URL(`projects/${projectId}/`, new URL(import.meta.env.BASE_URL, window.location.href))
    .href;
}

export function resolveAsset(project: LoadedProject, path: string): string {
  return new URL(path, project.baseUrl).href;
}

export function findUnit(project: LoadedProject, unitId: string | null): Unit | undefined {
  if (unitId === null) return undefined;
  return project.config.units.find((u) => u.id === unitId);
}

export class ProjectLoadError extends Error {
  override name = 'ProjectLoadError';
}

export async function loadProject(projectId: string, signal?: AbortSignal): Promise<LoadedProject> {
  if (!PROJECT_ID_RE.test(projectId)) {
    throw new ProjectLoadError(`"${projectId}" is not a valid project id.`);
  }
  const baseUrl = projectBaseUrl(projectId);
  const url = new URL('project.json', baseUrl).href;

  let res: Response;
  try {
    res = await fetch(url, { signal, cache: 'no-cache' });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ProjectLoadError(`Could not reach ${url}.`);
  }
  // Dev servers / SPA hosts often answer unknown paths with index.html (200, text/html).
  const isHtml = res.headers.get('content-type')?.includes('text/html') ?? false;
  if (!res.ok || isHtml) {
    throw new ProjectLoadError(`Project "${projectId}" was not found.`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ProjectLoadError(`projects/${projectId}/project.json is not valid JSON.`);
  }

  const parsed = ProjectFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new ProjectLoadError(
      `projects/${projectId}/project.json is invalid:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return { id: projectId, baseUrl, config: parsed.data };
}

/**
 * True when `url` points at a real binary asset. Treats an HTML response as "missing"
 * because Vite and most SPA hosts serve index.html for unknown paths.
 */
export async function assetExists(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal, cache: 'no-cache' });
    if (!res.ok) return false;
    return !(res.headers.get('content-type') ?? '').includes('text/html');
  } catch {
    return false;
  }
}
