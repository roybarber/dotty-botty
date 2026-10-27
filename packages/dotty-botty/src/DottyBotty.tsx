import {
  type CSSProperties,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  type EngineHandle,
  type ExpressionName,
  type ShapeName,
  type StateName,
  createEngine,
  renderStillSvg,
} from './engine';

export interface DottyBottyHandle {
  /** Squash the character and flash a surprised face. */
  poke(): void;
  blink(): void;
}

export interface DottyBottyProps {
  shape?: ShapeName;
  state?: StateName;
  /** Fixed expression; null lets the state choose. */
  expression?: ExpressionName | null;
  followPointer?: boolean;
  maxFrameRate?: number;
  /** Overrides the system prefers-reduced-motion setting when set. */
  reducedMotion?: boolean;
  /** Width and height in px (or any CSS length). */
  size?: number | string;
  /** Body color; defaults to currentColor. */
  ink?: string;
  /** Eye color; defaults to white. */
  spot?: string;
  /** Accessible name. Without it the character is decorative (aria-hidden). */
  label?: string;
  /** Renders a button that pokes the character when pressed. */
  pokeable?: boolean;
  onPoke?: () => void;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<DottyBottyHandle>;
}

export function DottyBotty({
  shape = 'blob',
  state = 'idle',
  expression = null,
  followPointer = true,
  maxFrameRate = 60,
  reducedMotion,
  size = 120,
  ink,
  spot,
  label,
  pokeable = false,
  onPoke,
  className,
  style,
  ref,
}: DottyBottyProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);

  // Server-rendered still frame. Created once and never changed, so React leaves
  // the host's children alone and the engine is free to patch them.
  const [poster] = useState(() => ({ __html: renderStillSvg({ shape, state, expression }) }));

  const options = { shape, state, expression, followPointer, maxFrameRate, reducedMotion };
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const engine = createEngine(hostRef.current!, optionsRef.current);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.update({ shape, state, expression, followPointer, maxFrameRate, reducedMotion });
  }, [shape, state, expression, followPointer, maxFrameRate, reducedMotion]);

  useImperativeHandle(
    ref,
    () => ({
      poke: () => engineRef.current?.poke(),
      blink: () => engineRef.current?.blink(),
    }),
    [],
  );

  const dimension = typeof size === 'number' ? `${size}px` : size;
  const boxStyle = {
    display: 'inline-block',
    width: dimension,
    height: dimension,
    lineHeight: 0,
    ...(ink && { '--dotty-ink': ink }),
    ...(spot && { '--dotty-spot': spot }),
    ...style,
  } as CSSProperties;

  const host = (
    <span ref={hostRef} style={{ display: 'block', width: '100%', height: '100%' }} dangerouslySetInnerHTML={poster} />
  );

  if (pokeable) {
    return (
      <button
        type="button"
        className={className}
        aria-label={label ?? 'Poke'}
        onClick={() => {
          engineRef.current?.poke();
          onPoke?.();
        }}
        style={{ ...boxStyle, padding: 0, border: 0, background: 'none', color: 'inherit', cursor: 'pointer' }}
      >
        {host}
      </button>
    );
  }

  return (
    <span
      className={className}
      style={boxStyle}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {host}
    </span>
  );
}
