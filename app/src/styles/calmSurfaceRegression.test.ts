// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const globalCss = readFileSync('src/styles/global.css', 'utf8');
const todayCss = readFileSync('src/styles/today-calm-surface.css', 'utf8');
const planCss = readFileSync('src/styles/plan-day-line.css', 'utf8');
const personalCss = readFileSync('src/styles/personal-trial.css', 'utf8');

// jsdom has no layout/media engine. Exercise matching rules at a declared
// viewport instead; real-device acceptance remains separate evidence.
function appliedStyle(element: HTMLElement, css: string, width: number) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const sheet = style.sheet!;
  const result = document.createElement('div').style;
  function visit(rules: CSSRuleList) {
    for (const rule of Array.from(rules)) {
      if ('selectorText' in rule && element.matches((rule as CSSStyleRule).selectorText)) {
        const declaration = (rule as CSSStyleRule).style;
        for (let index = 0; index < declaration.length; index += 1) {
          const property = declaration[index];
          result.setProperty(property, declaration.getPropertyValue(property));
        }
      } else if ('cssRules' in rule) {
        const condition = (rule as CSSMediaRule).conditionText ?? '';
        const maximum = condition.match(/max-width:\s*([\d.]+)(px|rem)/);
        if (!maximum || width <= Number(maximum[1]) * (maximum[2] === 'rem' ? 16 : 1)) {
          visit((rule as CSSMediaRule).cssRules);
        }
      }
    }
  }
  visit(sheet.cssRules);
  style.remove();
  return result;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('calm surface CSS regressions', () => {
  it('keeps stacked Save and technical backup buttons content-sized at 390px', () => {
    document.body.innerHTML = '<div class="setup-action-row"><button class="button">Save</button></div><div class="library-backup-actions"><button class="button">Export</button></div>';
    for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
      expect(appliedStyle(button.parentElement!, globalCss, 390).flexDirection).toBe('column');
      expect(appliedStyle(button, globalCss, 390).flexBasis).toBe('auto');
    }
  });

  it('hides prototype cards nested inside About but keeps current limits findable', () => {
    document.body.innerHTML = '<div class="app-shell" data-trial-mode="personal"><div class="setup-screen"><details open><summary>About this version</summary><div><section class="card" id="limits">Current limits</section><section class="card" id="dev"><div class="setup-dev-card"></div></section><section class="card" id="future"><div class="chip-row--quiet"></div></section><section class="card" id="migration"><button class="setup-advanced-toggle"></button></section></div></details></div></div>';
    for (const id of ['dev', 'future', 'migration']) {
      expect(appliedStyle(document.getElementById(id)!, personalCss, 390).display).toBe('none');
    }
    expect(appliedStyle(document.getElementById('limits')!, personalCss, 390).display).not.toBe('none');
  });
  it('keeps Today, re-entry, Reduce and contextual Move buttons content-sized at 390px', () => {
    document.body.innerHTML = '<div class="today-now"><div class="task-card__actions"><div class="task-card__secondary-actions"><button class="button">Start Boost</button></div></div></div><div class="reentry-review__options"><button class="button">Keep for review</button></div><div class="reduced-day-control__actions"><button class="button">Return to normal day</button></div><div class="plan-context-correction"><div class="button-row"><button class="button">Move</button></div></div>';
    for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
      const css = globalCss + todayCss + planCss;
      expect(appliedStyle(button.parentElement!, css, 390).flexDirection).toBe('column');
      expect(appliedStyle(button, css, 390).flexBasis).toBe('auto');
    }
  });

});
