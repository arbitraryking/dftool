import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { appendCsvValue, getImageResourcePathIssue, splitCsv } from '../domain/resourcePaths';
import { MapPoint } from '../domain/schemas';
import { getSelectedMap, useAppDispatch, useAppState } from '../state/appStore';
import { discardImportedScreenshots, importPointScreenshot, isTauriRuntime } from '../services/tauriApi';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function MarkerEditDialog() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const selectedMap = getSelectedMap(state);
  const editingPoint = state.editingPoint;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionImportedPathsRef = useRef<string[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [originalPointId, setOriginalPointId] = useState<string | undefined>();
  const [form, setForm] = useState({
    id: '',
    type: '',
    title: '',
    description: '',
    x: '0',
    y: '0',
    tags: '',
    screenshots: '',
  });

  useEffect(() => {
    if (!editingPoint) {
      void discardSessionImports();
      return;
    }

    void discardSessionImports();
    const pointId = 'id' in editingPoint ? editingPoint.id : undefined;
    setOriginalPointId(pointId);
    setImporting(false);
    setError('');
    setForm({
      id: pointId ?? '',
      type: editingPoint.type,
      title: editingPoint.title,
      description: editingPoint.description,
      x: String(editingPoint.x),
      y: String(editingPoint.y),
      tags: editingPoint.tags.join(', '),
      screenshots: editingPoint.screenshots.join(', '),
    });
  }, [editingPoint]);

  useEffect(() => {
    if (state.mode !== 'edit') {
      void discardSessionImports();
    }
  }, [state.mode]);

  useEffect(() => () => {
    void discardSessionImports();
  }, []);

  if (!editingPoint || state.mode !== 'edit') {
    return null;
  }

  const isExisting = Boolean(originalPointId && selectedMap?.points.some((point) => point.id === originalPointId));

  async function discardSessionImports() {
    const paths = sessionImportedPathsRef.current;
    if (paths.length === 0) {
      return;
    }

    sessionImportedPathsRef.current = [];
    try {
      await discardImportedScreenshots(paths);
    } catch (error: unknown) {
      setError(`清理未保存截图失败：${errorMessage(error)}`);
    }
  }

  function validateScreenshotPaths(paths: string[]): string | undefined {
    for (const path of paths) {
      const issue = getImageResourcePathIssue(path, { requireScreenshotRoot: true });
      if (issue) {
        return `截图路径 ${path} 无效：${issue}`;
      }
    }

    return undefined;
  }

  async function closeEditor() {
    await discardSessionImports();
    dispatch({ type: 'closeEditor' });
  }

  async function deleteCurrentPoint() {
    await discardSessionImports();
    if (originalPointId) {
      dispatch({ type: 'deletePoint', pointId: originalPointId });
    }
  }

  function startImport() {
    setError('');
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedMap) {
      return;
    }

    setImporting(true);
    setError('');

    try {
      const pointId = form.id.trim() || originalPointId;
      const importedPath = await importPointScreenshot(selectedMap.id, pointId, file);
      if (!importedPath) {
        return;
      }

      sessionImportedPathsRef.current = [...new Set([...sessionImportedPathsRef.current, importedPath])];
      setForm((current) => ({
        ...current,
        screenshots: appendCsvValue(current.screenshots, importedPath),
      }));
    } catch (error: unknown) {
      setError(`导入截图失败：${errorMessage(error)}`);
    } finally {
      setImporting(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const x = Number(form.x);
    const y = Number(form.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setError('坐标必须是有效数字');
      return;
    }

    const nextId = form.id.trim() || undefined;
    if (nextId && nextId !== originalPointId && selectedMap?.points.some((point) => point.id === nextId)) {
      setError(`ID ${nextId} 已存在`);
      return;
    }

    const screenshots = splitCsv(form.screenshots);
    const screenshotIssue = validateScreenshotPaths(screenshots);
    if (screenshotIssue) {
      setError(screenshotIssue);
      return;
    }

    const point: MapPoint = {
      id: nextId ?? '',
      type: form.type,
      title: form.title.trim() || '未命名点位',
      description: form.description,
      x,
      y,
      tags: splitCsv(form.tags),
      screenshots,
    };

    const sessionImportedPaths = sessionImportedPathsRef.current;
    const retainedImportedPaths = sessionImportedPaths.filter((path) => screenshots.includes(path));
    const removedImportedPaths = sessionImportedPaths.filter((path) => !screenshots.includes(path));

    dispatch({ type: 'savePoint', point, originalPointId });
    if (removedImportedPaths.length > 0) {
      void discardImportedScreenshots(removedImportedPaths);
    }
    if (selectedMap && retainedImportedPaths.length > 0) {
      dispatch({
        type: 'addPendingImportedScreenshots',
        mapId: selectedMap.id,
        paths: retainedImportedPaths,
      });
    }
    sessionImportedPathsRef.current = [];
  }

  return (
    <aside className="marker-editor">
      <form onSubmit={submit}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{isExisting ? '编辑点位' : '新增点位'}</h2>
          <button type="button" onClick={() => void closeEditor()}>关闭</button>
        </div>

        {error && <strong className="error">{error}</strong>}

        <label>
          ID
          <input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} placeholder="留空自动生成" />
        </label>

        <label>
          物资类型
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            {state.lootTypes?.types.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </label>

        <label>
          标题
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>

        <label>
          描述
          <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>

        <div className="row">
          <label>
            X
            <input type="number" min="0" max="1" step="0.001" value={form.x} onChange={(event) => setForm({ ...form, x: event.target.value })} />
          </label>
          <label>
            Y
            <input type="number" min="0" max="1" step="0.001" value={form.y} onChange={(event) => setForm({ ...form, y: event.target.value })} />
          </label>
        </div>

        <label>
          标签（逗号分隔）
          <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
        </label>

        <div className="screenshot-field">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>截图路径（逗号分隔，可置空）</span>
            <button type="button" onClick={startImport} disabled={!isTauriRuntime || importing || !selectedMap}>
              {importing ? '导入中...' : '导入截图'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => void handleFileSelected(event)}
            hidden
          />
          <input value={form.screenshots} onChange={(event) => setForm({ ...form, screenshots: event.target.value })} />
          {!isTauriRuntime && <span className="muted">浏览器预览不支持导入截图，可手动填写 public 下对应资源路径。</span>}
        </div>

        <div className="row">
          <button type="submit">保存到内存</button>
          {isExisting && originalPointId && (
            <button type="button" onClick={() => void deleteCurrentPoint()}>删除</button>
          )}
        </div>
      </form>
    </aside>
  );
}
