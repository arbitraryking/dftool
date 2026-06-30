import { FormEvent, useEffect, useState } from 'react';
import { MapPoint } from '../domain/schemas';
import { getSelectedMap, useAppDispatch, useAppState } from '../state/appStore';

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function MarkerEditDialog() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const selectedMap = getSelectedMap(state);
  const editingPoint = state.editingPoint;
  const [error, setError] = useState('');
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
      return;
    }

    const pointId = 'id' in editingPoint ? editingPoint.id : undefined;
    setOriginalPointId(pointId);
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

  if (!editingPoint || state.mode !== 'edit') {
    return null;
  }

  const isExisting = Boolean(originalPointId && selectedMap?.points.some((point) => point.id === originalPointId));

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

    const point: MapPoint = {
      id: nextId ?? '',
      type: form.type,
      title: form.title.trim() || '未命名点位',
      description: form.description,
      x,
      y,
      tags: splitCsv(form.tags),
      screenshots: splitCsv(form.screenshots),
    };

    dispatch({ type: 'savePoint', point, originalPointId });
  }

  return (
    <aside className="marker-editor">
      <form onSubmit={submit}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{isExisting ? '编辑点位' : '新增点位'}</h2>
          <button type="button" onClick={() => dispatch({ type: 'closeEditor' })}>关闭</button>
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

        <label>
          截图路径（逗号分隔，可置空）
          <input value={form.screenshots} onChange={(event) => setForm({ ...form, screenshots: event.target.value })} />
        </label>

        <div className="row">
          <button type="submit">保存到内存</button>
          {isExisting && originalPointId && (
            <button type="button" onClick={() => dispatch({ type: 'deletePoint', pointId: originalPointId })}>删除</button>
          )}
        </div>
      </form>
    </aside>
  );
}
