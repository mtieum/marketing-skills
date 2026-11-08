/**
 * A short is a run of sections, one voice-over line each. A section lasts as
 * long as its line (or an estimate from its words until the voice is made) and
 * its shots share that time; a card names what is on screen while they play.
 *
 * Paths are under the studio's media folder (staticFile), e.g.
 * "my-short/shots/bridge.mp4". Pictures of real places, people or products are
 * real and credited, never generated.
 */

export type Stop = { name: string; lat: number; lng: number };

export type Shot =
  /** Real footage, cropped upright; `from` is where in the clip to start (seconds). */
  | { kind: 'clip'; src: string; from?: number; credit: string; own?: boolean }
  /** A still, moving slowly. */
  | { kind: 'photo'; src: string; credit: string; own?: boolean; move?: 'in' | 'out' | 'left' | 'right' }
  /** A map flying from one point to the next with the route drawn between them (brand.map sets its look). */
  | { kind: 'map'; from: Stop; to: Stop }
  /** A page or app screen on a phone, scrolling, over a blurred clip or photo, with the logo and the brand's line. */
  | { kind: 'screen'; src: string; backdrop: string; credit: string; scroll?: number };

export type Card = {
  /** Small, in the accent colour, above: a time, a step, a moment. */
  kicker?: string;
  /** Large: what is on screen. */
  title: string;
  /** Small, in a pill, under: one fact worth knowing. */
  note?: string;
};

export type Section = {
  /** The voice-over. It is a claim like any other: it passes the fact gate. */
  vo: string;
  /** The spoken line once made: <slug>/voice/<nn>.mp3 (written by the voice tools). */
  voice?: string;
  /** A chapter name ("Day one", "Step 2"): the rail at the top shows the chapters and fills as they go. */
  chapter?: string;
  card?: Card;
  shots: Shot[];
  /** The opening title: `lead` small above (defaults to brand.hook.lead), `title` very large. */
  hook?: string | { lead?: string; title: string };
  /** The close: the music fades under it and it holds a little longer. */
  end?: boolean;
};

export type ShortSpec = {
  slug: string;
  /** For people: the title used in the upload notes. */
  title: string;
  /** Where the short sends people. */
  link: string;
  sections: Section[];
};
