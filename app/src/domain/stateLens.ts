export type StateLensId =
  | 'normal'
  | 'behind'
  | 'low-energy'
  | 'overstimulated'
  | 'avoiding'
  | 'restart'
  | 'bored';

export const defaultStateLens: StateLensId = 'normal';

