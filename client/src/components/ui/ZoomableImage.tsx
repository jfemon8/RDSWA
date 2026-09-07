import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCw, Shrink } from 'lucide-react';

export interface ZoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  rotate: () => void;
  reset: () => void;
  rotation: number;
}

interface Props {
  src: string;
  alt?: string;
  /** Replaces the default floating control cluster, letting a host put the buttons in its own bar. */
  toolbar?: (controls: ZoomControls) => ReactNode;
  /** Classes for the stage that holds the image. */
  stageClassName?: string;
  /** Inline height for the stage, since the hosts size it very differently. */
  stageStyle?: React.CSSProperties;
  imageClassName?: string;
}

/** Image viewer with pinch, wheel and double-tap zoom, drag panning, and rotation that stays inside the frame. */
export default function ZoomableImage({
  src,
  alt = '',
  toolbar,
  stageClassName = '',
  stageStyle,
  imageClassName = '',
}: Props) {
  const [rotation, setRotation] = useState(0);
  // A rotate() transform leaves the layout box unrotated, so a quarter turn needs its own scale to stay in frame.
  const [fitScale, setFitScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const measureFit = useCallback(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img?.naturalWidth || !img.naturalHeight) return;

    if (rotation % 180 === 0) {
      setFitScale(1);
      return;
    }

    // Size the image would take unrotated, derived from the natural ratio so the current scale never feeds back in.
    const stageW = stage.clientWidth;
    const stageH = stage.clientHeight;
    const ratio = img.naturalWidth / img.naturalHeight;
    const drawnW = Math.min(stageW, stageH * ratio);
    const drawnH = drawnW / ratio;
    if (!drawnW || !drawnH) return;

    // A quarter turn swaps the axes, so the drawn height must fit the stage width.
    setFitScale(Math.min(stageW / drawnH, stageH / drawnW, 1));
  }, [rotation]);

  useEffect(() => {
    measureFit();
  }, [measureFit, src]);

  // A different image starts upright, whatever the last one was left at.
  useEffect(() => {
    setRotation(0);
    setFitScale(1);
  }, [src]);

  useEffect(() => {
    window.addEventListener('resize', measureFit);
    return () => window.removeEventListener('resize', measureFit);
  }, [measureFit]);

  const button =
    'p-1.5 rounded bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm';

  return (
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
      maxScale={8}
      centerOnInit
      centerZoomedOut
      doubleClick={{ mode: 'toggle', step: 1.4 }}
      wheel={{ step: 0.15 }}
      pinch={{ step: 5 }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => {
        const controls: ZoomControls = {
          zoomIn: () => zoomIn(),
          zoomOut: () => zoomOut(),
          rotate: () => setRotation((r) => (r + 90) % 360),
          reset: () => {
            resetTransform();
            setRotation(0);
          },
          rotation,
        };

        return (
          <>
            {toolbar?.(controls)}
            <div
              ref={stageRef}
              style={stageStyle}
              className={`relative ${stageClassName}`}
              onClick={(e) => e.stopPropagation()}
            >
              {!toolbar && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                  <button type="button" onClick={controls.zoomOut} title="Zoom out" aria-label="Zoom out" className={button}>
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={controls.zoomIn} title="Zoom in" aria-label="Zoom in" className={button}>
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={controls.rotate} title="Rotate 90°" aria-label="Rotate 90 degrees" className={button}>
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={controls.reset} title="Reset view" aria-label="Reset view" className={button}>
                    <Shrink className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* touch-none hands every gesture to the zoom layer, so a pinch scales instead of scrolling the page. */}
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                wrapperClass="touch-none"
              >
                <img
                  ref={imgRef}
                  src={src}
                  alt={alt}
                  onLoad={measureFit}
                  style={{ transform: `rotate(${rotation}deg) scale(${fitScale})` }}
                  className={`max-h-full max-w-full object-contain select-none transition-transform duration-200 ${imageClassName}`}
                  draggable={false}
                />
              </TransformComponent>
            </div>
          </>
        );
      }}
    </TransformWrapper>
  );
}
