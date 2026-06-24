---
name: remotion
description: Build video and animation compositions with Remotion — the React framework for programmatic video. Use when rendering MP4s, GIFs, or animated sequences from React components, building motion graphics, or creating data-driven video content.
---

# remotion

Remotion lets you build videos in React. Every frame is a React component; time is just a prop.

## Installation

```bash
npm create video@latest          # scaffold a new project
# or add to an existing React project:
npm install remotion @remotion/cli
```

## Core concepts

### useCurrentFrame and useVideoConfig

```tsx
import { useCurrentFrame, useVideoConfig } from 'remotion'

export const MyComp = () => {
  const frame = useCurrentFrame()           // 0-based frame number
  const { fps, durationInFrames, width, height } = useVideoConfig()
  return <div>Frame {frame} of {durationInFrames}</div>
}
```

### interpolate

Map a frame range to a value range:

```tsx
import { interpolate } from 'remotion'

const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
})
```

Always clamp both sides unless you intentionally want extrapolation.

### spring

Physics-based animation — smoother than linear interpolate for motion:

```tsx
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

const frame = useCurrentFrame()
const { fps } = useVideoConfig()

const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } })
```

### Sequence

Offset and trim child components in time:

```tsx
import { Sequence } from 'remotion'

<Sequence from={30} durationInFrames={60}>
  <MyComponent />
</Sequence>
```

`from` is the frame at which this sequence starts. The child receives `frame=0` at that point.

### AbsoluteFill

Full-bleed positioning for layering:

```tsx
import { AbsoluteFill } from 'remotion'

<AbsoluteFill style={{ backgroundColor: 'white' }}>
  <MyLayer />
</AbsoluteFill>
```

### Composition

Register a composition in `Root.tsx`:

```tsx
import { Composition } from 'remotion'
import { MyComp } from './MyComp'

export const RemotionRoot = () => (
  <Composition
    id="MyVideo"
    component={MyComp}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{}}
  />
)
```

## Audio

```tsx
import { Audio } from 'remotion'
import music from './music.mp3'

<Audio src={music} startFrom={0} endAt={90} volume={0.8} />
```

## CLI workflow

```bash
npx remotion studio          # open the browser-based preview
npx remotion render MyVideo  # render to out/MyVideo.mp4
npx remotion render MyVideo --codec gif  # render as GIF
```

## Common patterns

### Fade in / fade out

```tsx
const opacity = interpolate(frame, [0, 20, durationInFrames - 20, durationInFrames], [0, 1, 1, 0], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
})
```

### Slide in from bottom

```tsx
const translateY = interpolate(frame, [0, 20], [50, 0], { extrapolateRight: 'clamp' })
const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
```

### Staggered list

```tsx
{items.map((item, i) => (
  <Sequence key={i} from={i * 10}>
    <ListItem item={item} />
  </Sequence>
))}
```

## Performance

- Keep components pure — the same frame must always produce the same output
- Avoid `Math.random()` and `Date.now()` in render (breaks determinism)
- Use `staticFile()` for assets so they resolve correctly in both Studio and render

---

_Original skill for pro-dev-skillset (Jody Brewster). MIT License._
