export function placementReasonLines(provenance: readonly string[]): string[] {
  const lines: string[] = [];

  const push = (value: string) => {
    if (!lines.includes(value)) lines.push(value);
  };

  for (const item of provenance) {
    if (item.startsWith('Matched explicit Prefer guidance ')) {
      push('A saved Prefer preference favored this time.');
      continue;
    }
    if (item.startsWith('Overlapped explicit Avoid guidance ')) {
      push('This time overlaps a saved Avoid preference, so that preference did not favor this placement.');
      continue;
    }
    if (item.startsWith('Matched explicit preference ')) {
      push('A saved scheduling preference was part of this placement decision.');
      continue;
    }
    if (item.startsWith('Conflicting preference guidance was not used')) {
      push('Saved preferences conflict at this time, so neither side was used to choose it.');
      continue;
    }
    if (item.startsWith('Used the ')) {
      const match = /^Used the (minimum|normal|full) form \((\d+) minutes\)\./.exec(item);
      if (match) {
        push(`The ${match[1]} version fits here (${match[2]} minutes).`);
        continue;
      }
    }
    if (item.startsWith('Placed inside candidate interval ')) {
      push('This sits inside time Life Rhythm can use while keeping hard and protected boundaries clear.');
      continue;
    }
    if (item.startsWith('Automatically placed by ')) {
      push('Life Rhythm placed this flexible item automatically.');
      continue;
    }
    if (
      item.includes('preferred rhythm day') ||
      item.includes('rhythm preferred time') ||
      item.includes('Minimum Done') ||
      item.includes('deadline') ||
      item.includes('fixed time')
    ) {
      push(item);
    }
  }

  return lines.slice(0, 4);
}
