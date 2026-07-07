import { ImgHTMLAttributes, useEffect, useState } from 'react';
import { resolveResourceUrl } from '../services/tauriApi';
import { getSelectedMap, useAppDispatch, useAppState } from '../state/appStore';

type ResourceImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
};

function ResourceImage({ src, ...props }: ResourceImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(`/${src}`);

  useEffect(() => {
    let disposed = false;

    resolveResourceUrl(src)
      .then((url) => {
        if (!disposed) setResolvedSrc(url);
      })
      .catch(() => {
        if (!disposed) setResolvedSrc(`/${src}`);
      });

    return () => {
      disposed = true;
    };
  }, [src]);

  return <img src={resolvedSrc} {...props} />;
}

export function MarkerDetails() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [imageIndex, setImageIndex] = useState(0);
  const selectedMap = getSelectedMap(state);
  const point = selectedMap?.points.find((item) => item.id === state.selectedPointId);
  const type = state.lootTypes?.types.find((item) => item.id === point?.type);

  if (!point || state.mode !== 'inspect') {
    return null;
  }

  const screenshot = point.screenshots[imageIndex];

  return (
    <aside className="marker-details">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{point.title}</h2>
        <button onClick={() => dispatch({ type: 'selectPoint', pointId: undefined })}>关闭</button>
      </div>
      <p className="muted">类型：{type?.name ?? point.type}</p>
      {point.description && <p>{point.description}</p>}
      {point.tags.length > 0 && <p className="muted">标签：{point.tags.join('、')}</p>}
      <div className="screenshot-box">
        {screenshot ? <ResourceImage src={screenshot} alt={point.title} onError={(event) => (event.currentTarget.alt = '截图缺失')} /> : <span className="muted">暂无实景截图</span>}
      </div>
      {point.screenshots.length > 1 && (
        <div className="row">
          <button onClick={() => setImageIndex((value) => Math.max(0, value - 1))}>上一张</button>
          <span>{imageIndex + 1} / {point.screenshots.length}</span>
          <button onClick={() => setImageIndex((value) => Math.min(point.screenshots.length - 1, value + 1))}>下一张</button>
        </div>
      )}
    </aside>
  );
}
