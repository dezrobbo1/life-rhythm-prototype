import { describe, expect, it } from 'vitest';
import personalTrialCss from './personal-trial.css?raw';

describe('personal trial Library controls', () => {
  it('keeps durable rhythm state and its first action visible', () => {
    expect(personalTrialCss).not.toContain(".library-card__state,");
    expect(personalTrialCss).not.toContain(".library-card__actions > .button:first-child");
  });
});
