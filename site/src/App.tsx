import { useRef, useState } from 'react';

import {
  DottyBotty,
  type DottyBottyHandle,
  EXPRESSION_NAMES,
  type ExpressionName,
  SHAPE_NAMES,
  type ShapeName,
  STATE_NAMES,
  type StateName,
} from 'dotty-botty';

const PALETTES = [
  { name: 'Ink', ink: undefined, spot: undefined },
  { name: 'Tomato', ink: '#ff5a36', spot: '#2b0d06' },
  { name: 'Cobalt', ink: '#2f6bff', spot: '#f4f8ff' },
  { name: 'Moss', ink: '#3e7d4f', spot: '#f3f1e7' },
  { name: 'Grape', ink: '#6a3cc8', spot: '#ffffff' },
  { name: 'Sun', ink: '#ffc21a', spot: '#2a1d00' },
];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
    } catch {
      setCopied(null);
    }
  };
  return { copied, copy };
}

function Code({ id, code, copy }: { id: string; code: string; copy: ReturnType<typeof useCopy> }) {
  return (
    <div className="code">
      <pre>
        <code>{code}</code>
      </pre>
      <button type="button" className="copy" onClick={() => copy.copy(id, code)}>
        {copy.copied === id ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Chips<T extends string | null>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="chips">
      <legend>{label}</legend>
      {items.map(([v, text]) => (
        <button key={text} type="button" className="chip" aria-pressed={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </fieldset>
  );
}

const PROPS: [string, string, string, string][] = [
  ['state', 'StateName', "'idle'", 'Which animation plays. Changing it cross-fades the motion.'],
  ['shape', 'ShapeName', "'blob'", 'Body outline. Changing it morphs from the current shape.'],
  ['expression', 'ExpressionName | null', 'null', 'Pins the eyes to one expression. null lets the state decide.'],
  ['size', 'number | string', '120', 'Width and height, in px or any CSS length.'],
  ['ink', 'string', 'currentColor', 'Body color. Also settable with the --dotty-ink CSS variable.'],
  ['spot', 'string', "'#fff'", 'Eye color. Also settable with the --dotty-spot CSS variable.'],
  ['followPointer', 'boolean', 'true', 'Eyes track the pointer anywhere on the page.'],
  ['maxFrameRate', 'number', '60', 'Caps how often this character redraws.'],
  ['reducedMotion', 'boolean', 'system', 'Forces a still frame on or off. Defaults to prefers-reduced-motion.'],
  ['label', 'string', '', 'Accessible name. Without it the character is hidden from assistive tech.'],
  ['pokeable', 'boolean', 'false', 'Renders a button that squashes the character when pressed.'],
  ['onPoke', '() => void', '', 'Called after a poke from the button.'],
  ['ref', 'Ref<DottyBottyHandle>', '', 'Gives you poke() and blink().'],
];

export function App() {
  const copy = useCopy();
  const bot = useRef<DottyBottyHandle>(null);
  const [state, setState] = useState<StateName>('idle');
  const [expression, setExpression] = useState<ExpressionName | null>(null);
  const [shape, setShape] = useState<ShapeName>('blob');
  const [palette, setPalette] = useState(PALETTES[0]);
  const [follow, setFollow] = useState(true);
  const [reduced, setReduced] = useState(false);

  const shared = { followPointer: follow, reducedMotion: reduced || undefined, ink: palette.ink, spot: palette.spot };

  const jsxProps = [
    state !== 'idle' && `state="${state}"`,
    shape !== 'blob' && `shape="${shape}"`,
    expression && `expression="${expression}"`,
    palette.ink && `ink="${palette.ink}"`,
    palette.spot && `spot="${palette.spot}"`,
    !follow && 'followPointer={false}',
    'size={160}',
  ].filter(Boolean);
  const snippet = `<DottyBotty ${jsxProps.join(' ')} />`;

  const pick = (fn: () => void) => {
    fn();
    document.getElementById('playground')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <>
      <header className="top">
        <a className="brand" href="#top">
          <DottyBotty size={28} state="idle" {...shared} />
          <span>dotty-botty</span>
        </a>
        <nav>
          <a href="#playground">Playground</a>
          <a href="#usage">Usage</a>
          <a href="#api">API</a>
          <a href="https://github.com/roybarber/dotty-botty">GitHub</a>
          <a href="https://www.npmjs.com/package/dotty-botty">npm</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <h1>A tiny character for your React app.</h1>
            <p>
              Dotty Botty is a procedural SVG character that blinks, glances, follows the pointer, and reacts when you
              poke it. Drop it into empty states, loaders, onboarding, or anywhere a bit of personality helps.
            </p>
            <Code id="install" code="npm install dotty-botty" copy={copy} />
            <ul className="facts">
              <li>27 shapes</li>
              <li>12 expressions</li>
              <li>9 animated states</li>
              <li>No dependencies</li>
              <li>MIT</li>
            </ul>
          </div>
          <div className="hero-bot">
            <DottyBotty size="min(300px, 70vw)" state={state} shape={shape} expression={expression} pokeable label="Dotty Botty. Press to poke." {...shared} />
            <p className="hint">Click it.</p>
          </div>
        </section>

        <section id="playground" className="panel playground">
          <div className="pg-stage">
            <DottyBotty ref={bot} size={200} state={state} shape={shape} expression={expression} pokeable label={`Dotty Botty, ${state}. Press to poke.`} {...shared} />
            <div className="pg-actions">
              <button type="button" className="chip" onClick={() => bot.current?.poke()}>Poke</button>
              <button type="button" className="chip" onClick={() => bot.current?.blink()}>Blink</button>
            </div>
            <Code id="snippet" code={snippet} copy={copy} />
          </div>
          <div className="pg-controls">
            <h2>Playground</h2>
            <Chips label="State" items={STATE_NAMES.map((s) => [s, cap(s)])} value={state} onChange={setState} />
            <Chips<ExpressionName | null>
              label="Expression"
              items={[[null, 'Auto'], ...EXPRESSION_NAMES.map((e): [ExpressionName, string] => [e, cap(e)])]}
              value={expression}
              onChange={setExpression}
            />
            <Chips label="Shape" items={SHAPE_NAMES.map((s) => [s, cap(s)])} value={shape} onChange={setShape} />
            <fieldset className="chips">
              <legend>Color</legend>
              {PALETTES.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="swatch"
                  aria-label={`${p.name} color`}
                  aria-pressed={p === palette}
                  style={{ background: p.ink ?? 'var(--text)' }}
                  onClick={() => setPalette(p)}
                />
              ))}
            </fieldset>
            <div className="toggles">
              <label><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow pointer</label>
              <label><input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} /> Reduced motion</label>
            </div>
          </div>
        </section>

        <section>
          <h2>States</h2>
          <p className="sub">Each state is a function of time. Switching between them blends the motion, so nothing jumps.</p>
          <div className="gallery">
            {STATE_NAMES.map((s) => (
              <button key={s} type="button" className="card" aria-pressed={s === state} onClick={() => pick(() => setState(s))}>
                <DottyBotty size={84} state={s} shape={s === 'sleeping' ? 'pebble' : 'blob'} {...shared} />
                <small>{cap(s)}</small>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Shapes</h2>
          <p className="sub">Every shape is sampled at the same 96 angles, so any shape can morph into any other.</p>
          <div className="gallery">
            {SHAPE_NAMES.map((s) => (
              <button key={s} type="button" className="card" aria-pressed={s === shape} onClick={() => pick(() => setShape(s))}>
                <DottyBotty size={72} shape={s} {...shared} />
                <small>{cap(s)}</small>
              </button>
            ))}
          </div>
        </section>

        <section id="usage" className="prose">
          <h2>Usage</h2>
          <p>Requires React 19 or later.</p>
          <Code
            id="basic"
            copy={copy}
            code={`import { DottyBotty } from 'dotty-botty';

export function EmptyInbox() {
  return <DottyBotty state="sleeping" size={96} label="Nothing here yet" />;
}`}
          />
          <h3>Drive it from your app state</h3>
          <Code
            id="state"
            copy={copy}
            code={`<DottyBotty
  state={isSaving ? 'working' : saved ? 'celebrating' : 'idle'}
  shape="cat"
  ink="#2f6bff"
/>`}
          />
          <h3>Poke and blink on demand</h3>
          <Code
            id="ref"
            copy={copy}
            code={`const bot = useRef<DottyBottyHandle>(null);

<DottyBotty ref={bot} />
<button onClick={() => bot.current?.poke()}>Boop</button>`}
          />
          <h3>Theme with CSS</h3>
          <p>
            The body uses <code>currentColor</code> by default, so it follows your text color. Set{' '}
            <code>--dotty-ink</code> and <code>--dotty-spot</code> on any ancestor to restyle every character inside it.
          </p>
          <Code
            id="css"
            copy={copy}
            code={`.sidebar {
  --dotty-ink: #3e7d4f;
  --dotty-spot: #f3f1e7;
}`}
          />
          <h3>Next.js and server rendering</h3>
          <p>
            The package is marked <code>'use client'</code>. On the server it renders a still frame as plain SVG, so the
            character is visible before JavaScript loads. Once the page loads, it starts animating that same markup.
          </p>
        </section>

        <section id="api">
          <h2>Props</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Prop</th><th>Type</th><th>Default</th><th>What it does</th></tr>
              </thead>
              <tbody>
                {PROPS.map(([name, type, def, desc]) => (
                  <tr key={name}>
                    <td><code>{name}</code></td>
                    <td><code>{type}</code></td>
                    <td>{def && <code>{def}</code>}</td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sub">
            <code>STATE_NAMES</code>, <code>SHAPE_NAMES</code> and <code>EXPRESSION_NAMES</code> are exported for building
            pickers like the one above.
          </p>
        </section>

        <section className="prose">
          <h2>How it works</h2>
          <p>
            There are no keyframes or image assets. Each frame, the character's outline, eyes, and extras are computed
            from a handful of numbers and written out as an SVG string. That string is compared with the previous frame,
            and only the attribute values that changed are written to the DOM. React renders the component once and is
            not involved in the animation after that.
          </p>
          <p>
            All characters on a page share one <code>requestAnimationFrame</code> loop. A character stops updating when
            it scrolls off screen or the tab is hidden. With reduced motion turned on, it draws a single still frame and
            does not animate.
          </p>
          <h3>Accessibility</h3>
          <p>
            Without a <code>label</code> the character is decorative and hidden from screen readers. With one, it is
            announced as an image. With <code>pokeable</code> it becomes a real button you can reach and press from
            the keyboard.
          </p>
        </section>
      </main>

      <footer className="foot">
        <span>MIT licensed. Made by Roy Barber.</span>
        <a href="https://github.com/roybarber/dotty-botty">Source on GitHub</a>
      </footer>
    </>
  );
}
