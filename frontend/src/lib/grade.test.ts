import { describe, expect, it } from 'vitest';
import { gradeLocally, normalize, similarity } from './grade';

describe('normalize', () => {
  it('folds Lithuanian diacritics so a plain keyboard works', () => {
    expect(normalize('Ačiū')).toBe('aciu');
    expect(normalize('Į priedangą!')).toBe('i priedanga');
    expect(normalize('žemėlapis')).toBe('zemelapis');
  });

  it('collapses punctuation and spacing', () => {
    expect(normalize('Stok!  Kas eina?')).toBe('stok kas eina');
    expect(normalize('  pone   kapitone  ')).toBe('pone kapitone');
  });

  it('matches the server so instant feedback never contradicts the score', () => {
    // These pairs must fold to the same string on both sides.
    const pairs: [string, string][] = [
      ['Dėmesio!', 'demesio'],
      ['Gulk!', 'gulk'],
      ['Kaip girdite?', 'kaip girdite'],
    ];
    for (const [a, b] of pairs) {
      expect(normalize(a)).toBe(normalize(b));
    }
  });
});

describe('similarity', () => {
  it('is 1 for identical strings and low for unrelated ones', () => {
    expect(similarity('stok', 'stok')).toBe(1);
    expect(similarity('stok', 'gulk')).toBeLessThan(0.6);
  });

  it('handles empty input without dividing by zero', () => {
    expect(similarity('', '')).toBe(1);
    expect(similarity('', 'stok')).toBe(0);
  });
});

describe('gradeLocally', () => {
  it('accepts the exact answer', () => {
    expect(gradeLocally('select', 'Stok!', undefined, 'Stok!').correct).toBe(true);
  });

  it('accepts a diacritic-free spelling on typed exercises', () => {
    const result = gradeLocally('write', 'Dėmesio!', undefined, 'demesio');
    expect(result.correct).toBe(true);
    expect(result.typo).toBe(false);
  });

  it('accepts a listed alternative form', () => {
    const result = gradeLocally('write', 'Sek mane!', ['sekite mane'], 'Sekite mane');
    expect(result.correct).toBe(true);
  });

  it('forgives one slipped letter in a typed sentence', () => {
    expect(gradeLocally('write', 'Priešas kairėje', undefined, 'Priesas kaireje').correct).toBe(
      true,
    );
  });

  it('is strict on multiple choice', () => {
    expect(gradeLocally('select', 'Gulk!', undefined, 'Kelkis!').correct).toBe(false);
  });

  it('is lenient on speaking, where recognition mangles endings', () => {
    expect(
      gradeLocally('speak', 'Skyrius pasiruošęs', undefined, 'skyrius pasiruoses').correct,
    ).toBe(true);
    expect(gradeLocally('speak', 'Skyrius pasiruošęs', undefined, 'labas rytas').correct).toBe(
      false,
    );
  });

  it('rejects a wrong case ending — the whole point of the drill', () => {
    expect(
      gradeLocally('write', 'Priedanga po tiltu', undefined, 'Priedanga po tiltas').correct,
    ).toBe(false);
  });

  it('treats an empty answer as wrong', () => {
    expect(gradeLocally('write', 'Stok!', undefined, '').correct).toBe(false);
  });
});
