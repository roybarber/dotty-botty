# dotty-botty

Dotty is a tiny procedural SVG character for your agents and generative UI. Its states map onto what an agent is doing, like thinking while the model reasons or working while a tool runs. It blinks, follows the pointer, and squashes when you poke it.

- 27 shapes, 12 expressions, 9 animated states
- About 7 KB gzipped, no dependencies
- Server-renders a still frame, then animates on the client
- Respects `prefers-reduced-motion`
- MIT licensed

**Demo and docs:** https://dotty.roybarber.com

## Install

```bash
npm install dotty-botty
```

Requires React 19 or later.

## Usage

```tsx
import { DottyBotty } from 'dotty-botty';

export function EmptyInbox() {
  return <DottyBotty state="sleeping" size={96} label="Nothing here yet" />;
}
```

Give an agent a face by mapping your chat status onto a state. This uses `useChat` from the Vercel AI SDK, but any loading flag works:

```tsx
const { status } = useChat();

<DottyBotty
  state={
    status === 'submitted' ? 'thinking'
    : status === 'streaming' ? 'working'
    : status === 'error' ? 'alert'
    : 'idle'
  }
  label="Assistant"
/>
```

Poke and blink on demand:

```tsx
const bot = useRef<DottyBottyHandle>(null);

<DottyBotty ref={bot} />
<button onClick={() => bot.current?.poke()}>Boop</button>
```

## Props

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `state` | `StateName` | `'idle'` | Which animation plays. Changing it cross-fades the motion. |
| `shape` | `ShapeName` | `'ghost'` | Body outline. Changing it morphs from the current shape. |
| `expression` | `ExpressionName \| null` | `null` | Pins the eyes to one expression. `null` lets the state decide. |
| `size` | `number \| string` | `120` | Width and height, in px or any CSS length. |
| `ink` | `string` | `'#ff6b1a'` | Body color. Also settable with `--dotty-ink`. |
| `spot` | `string` | `'#fff'` | Eye color. Also settable with `--dotty-spot`. |
| `followPointer` | `boolean` | `true` | Eyes track the pointer anywhere on the page. |
| `maxFrameRate` | `number` | `60` | Caps how often this character redraws. |
| `reducedMotion` | `boolean` | system | Forces a still frame on or off. Defaults to `prefers-reduced-motion`. |
| `label` | `string` | | Accessible name. Without it the character is hidden from assistive tech. |
| `pokeable` | `boolean` | `false` | Renders a button that squashes the character when pressed. |
| `onPoke` | `() => void` | | Called after a poke from the button. |
| `ref` | `Ref<DottyBottyHandle>` | | Gives you `poke()` and `blink()`. |

**States:** idle, thinking, working, listening, bouncing, celebrating, sleeping, alert, shapeshift.

**Expressions:** neutral, happy, surprised, sad, angry, sleepy, squinted, calm, thinking, inspecting, confused, asleep.

**Shapes:** blob, circle, squircle, egg, bean, pebble, hex, star, diamond, triangle, pentagon, flower, clover, gear, burst, lemon, peanut, drop, heart, cloud, bear, bunny, cat, ghost, house, shield, crown.

`STATE_NAMES`, `SHAPE_NAMES` and `EXPRESSION_NAMES` are exported if you want to build a picker.

## Theming

Dotty is orange by default. Pass `ink` and `spot`, or set CSS variables on any ancestor to restyle every character inside it. Use `currentColor` to follow your text color.

```css
.sidebar {
  --dotty-ink: #3e7d4f;
  --dotty-spot: #f3f1e7;
}
```

## How it works

There are no keyframes or image assets. Each frame, the outline, eyes and extras are computed from a handful of numbers and written out as an SVG string. The string is compared with the previous frame and only the attribute values that changed are written to the DOM, so React is not involved in the animation after the first render.

All characters on a page share one `requestAnimationFrame` loop. A character stops updating when it is off screen or the tab is hidden. With reduced motion, it draws one still frame and does not animate.

## Accessibility

Without a `label` the character is decorative (`aria-hidden`). With one it is announced as an image. With `pokeable` it renders a real `<button>` that works from the keyboard.

## Inspiration

Dotty is inspired by agent characters like the Grok bot from xAI. It is an independent project written from scratch and is not affiliated with xAI.

## License

MIT
