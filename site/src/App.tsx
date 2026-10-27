import { useEffect, useRef, useState } from 'react';

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

import type { Lang } from './highlight';

interface Palette {
  name: string;
  swatch: string;
  ink?: string;
  spot?: string;
}

// Orange has no ink/spot so it shows the component defaults (and the snippet stays short).
const PALETTES: Palette[] = [
  { name: 'Orange', swatch: '#ff6b1a' },
  { name: 'Ink', swatch: 'var(--text)', ink: 'currentColor', spot: 'var(--page)' },
  { name: 'Tomato', swatch: '#ff4a2e', ink: '#ff4a2e', spot: '#2b0d06' },
  { name: 'Cherry', swatch: '#c81e3a', ink: '#c81e3a', spot: '#fff1f3' },
  { name: 'Rose', swatch: '#f43f5e', ink: '#f43f5e', spot: '#ffffff' },
  { name: 'Bubblegum', swatch: '#f472b6', ink: '#f472b6', spot: '#4a0d2c' },
  { name: 'Peach', swatch: '#fdba74', ink: '#fdba74', spot: '#431407' },
  { name: 'Sun', swatch: '#ffc21a', ink: '#ffc21a', spot: '#2a1d00' },
  { name: 'Lime', swatch: '#a3e635', ink: '#a3e635', spot: '#1a2e05' },
  { name: 'Moss', swatch: '#3e7d4f', ink: '#3e7d4f', spot: '#f3f1e7' },
  { name: 'Mint', swatch: '#34d399', ink: '#34d399', spot: '#052e1f' },
  { name: 'Teal', swatch: '#0d9488', ink: '#0d9488', spot: '#f0fdfa' },
  { name: 'Sky', swatch: '#38bdf8', ink: '#38bdf8', spot: '#082f49' },
  { name: 'Cobalt', swatch: '#2f6bff', ink: '#2f6bff', spot: '#f4f8ff' },
  { name: 'Navy', swatch: '#1e3a8a', ink: '#1e3a8a', spot: '#dbeafe' },
  { name: 'Lavender', swatch: '#a78bfa', ink: '#a78bfa', spot: '#1e1340' },
  { name: 'Grape', swatch: '#6a3cc8', ink: '#6a3cc8', spot: '#ffffff' },
  { name: 'Slate', swatch: '#475569', ink: '#475569', spot: '#f8fafc' },
];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

let highlighter: Promise<typeof import('./highlight')> | null = null;
const loadHighlighter = () => (highlighter ??= import('./highlight'));

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

function Code({ id, code, lang = 'tsx', copy }: { id: string; code: string; lang?: Lang; copy: ReturnType<typeof useCopy> }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadHighlighter()
      .then((m) => m.highlight(code, lang))
      .then((h) => live && setHtml(h))
      .catch(() => live && setHtml(null));
    return () => {
      live = false;
    };
  }, [code, lang]);

  return (
    <div className="code">
      {html ? (
        <div className="highlighted" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre>
          <code>{code}</code>
        </pre>
      )}
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
  ['shape', 'ShapeName', "'ghost'", 'Body outline. Changing it morphs from the current shape.'],
  ['expression', 'ExpressionName | null', 'null', 'Pins the eyes to one expression. null lets the state decide.'],
  ['size', 'number | string', '120', 'Width and height, in px or any CSS length.'],
  ['ink', 'string', "'#ff6b1a'", 'Body color. Also settable with the --dotty-ink CSS variable.'],
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
  const [shape, setShape] = useState<ShapeName>('ghost');
  const [palette, setPalette] = useState(PALETTES[0]);
  const [follow, setFollow] = useState(true);
  const [reduced, setReduced] = useState(false);

  const shared = { followPointer: follow, reducedMotion: reduced || undefined, ink: palette.ink, spot: palette.spot };

  const jsxProps = [
    state !== 'idle' && `state="${state}"`,
    shape !== 'ghost' && `shape="${shape}"`,
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
          <DottyBotty size={30} {...shared} />
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
            <h1>Dotty, a tiny character for your agents and generative UI.</h1>
            <p>
              Give your AI agent a face. Dotty is a procedural SVG character for React whose states map onto what an
              agent is doing, like thinking while the model reasons or working while a tool runs. It blinks, follows the
              pointer, and reacts when you poke it.
            </p>
            <Code id="install" code="npm install dotty-botty" lang="bash" copy={copy} />
            <ul className="facts">
              <li>27 shapes</li>
              <li>12 expressions</li>
              <li>9 animated states</li>
              <li>18 colors to start from</li>
              <li>No dependencies</li>
              <li>MIT</li>
            </ul>
          </div>
          <div className="hero-bot">
            <DottyBotty size="min(300px, 70vw)" state={state} shape={shape} expression={expression} pokeable label="Dotty. Press to poke." {...shared} />
            <p className="hint">Click it.</p>
          </div>
        </section>

        <section id="playground" className="panel playground">
          <div className="pg-stage">
            <DottyBotty ref={bot} size={200} state={state} shape={shape} expression={expression} pokeable label={`Dotty, ${state}. Press to poke.`} {...shared} />
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
                  title={p.name}
                  aria-label={`${p.name} color`}
                  aria-pressed={p === palette}
                  style={{ background: p.swatch }}
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
                <DottyBotty size={84} state={s} shape={shape} {...shared} />
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
          <h3>Give an agent a face</h3>
          <p>
            Map your chat status onto a state. This example uses <code>useChat</code> from the Vercel AI SDK, but any
            loading flag works.
          </p>
          <Code
            id="agent"
            copy={copy}
            code={`const { status } = useChat();

<DottyBotty
  state={
    status === 'submitted' ? 'thinking'
    : status === 'streaming' ? 'working'
    : status === 'error' ? 'alert'
    : 'idle'
  }
  label="Assistant"
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
            Dotty is orange by default. Pass <code>ink</code> and <code>spot</code>, or set <code>--dotty-ink</code> and{' '}
            <code>--dotty-spot</code> on any ancestor to restyle every character inside it. Use{' '}
            <code>currentColor</code> to follow your text color.
          </p>
          <Code
            id="css"
            lang="css"
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
          <p className="sub after-table">
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
          <h3>Inspiration</h3>
          <p>
            Dotty is inspired by agent characters like the Grok bot from xAI. It is an independent project written from
            scratch and is not affiliated with xAI.
          </p>
        </section>
      </main>

      <footer className="foot">
        <span>
          MIT licensed. Made by{' '}
          <a href="https://roybarber.com" target="_blank" rel="noopener" referrerPolicy="origin">
            Roy Barber
          </a>
          .
        </span>
        <a href="https://github.com/roybarber/dotty-botty">Source on GitHub</a>
      </footer>
    </>
  );
}
