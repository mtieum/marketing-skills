import { Composition } from 'remotion';
import { BrandPreview } from './BrandPreview';
import { FPS, H, W } from './brand';
// Written by tools/index.mjs from shorts/*.json (run by `npm run studio` and tools/build.sh).
import { shorts } from './generated/shorts';
import { Short, type ShortProps } from './Short';
import { timeline } from './timing';

export const Root = () => (
  <>
    {/* One frame showing the whole kit: colours, type, logo, a card, a caption. For checking a brand kit. */}
    <Composition id="brand-preview" component={BrandPreview} width={W} height={H} fps={FPS} durationInFrames={60} />
    {shorts.map((short) => (
      <Composition
        key={short.slug}
        id={short.slug}
        component={Short}
        width={W}
        height={H}
        fps={FPS}
        durationInFrames={FPS * 30}
        defaultProps={{ short, timed: [] } satisfies ShortProps}
        calculateMetadata={async ({ props }) => {
          const timed = await timeline(props.short);
          const last = timed[timed.length - 1]!;
          return { durationInFrames: last.start + last.frames, props: { ...props, timed } };
        }}
      />
    ))}
  </>
);
