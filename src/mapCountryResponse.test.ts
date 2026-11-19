import { describe, expect, it } from 'vitest';
import spainJson from './fixtures/spain.json' with { type: 'json' };
import unitedJson from './fixtures/united.json' with { type: 'json' };
import { mapCountryResponse } from './mapCountryResponse.js';
import type { RawCountry } from './types.js';

const spainRaw: RawCountry[] = spainJson;
const unitedRaw: RawCountry[] = unitedJson;

function pick(list: RawCountry[], code: string): RawCountry {
  const found = list.find((country) => country.alpha3Code === code);
  if (!found) {
    throw new Error(`Fixture ${code} not found`);
  }
  return found;
}

describe('mapCountryResponse', () => {
  it('maps a fully described country', () => {
    expect(mapCountryResponse(spainRaw)).toEqual([
      {
        code: 'ESP',
        name: 'Spain',
        nativeName: 'España',
        demonym: 'Spanish',
        independent: true,
        flagUrl: 'https://flagcdn.com/es.svg',
        capital: 'Madrid',
        region: 'Europe',
        subregion: 'Southern Europe',
        population: 47351567,
        area: 505992,
        borders: ['AND', 'FRA', 'GIB', 'PRT', 'MAR'],
        languages: ['Spanish'],
        currencies: ['Euro (€)'],
      },
    ]);
  });

  it('returns an empty array for an empty response', () => {
    expect(mapCountryResponse([])).toEqual([]);
  });

  it('keeps the order and the count of countries', () => {
    const result = mapCountryResponse(unitedRaw);

    expect(result.map((country) => country.name)).toEqual([
      'United States Minor Outlying Islands',
      'Tanzania, United Republic of',
      'United Arab Emirates',
      'United Kingdom of Great Britain and Northern Ireland',
      'United States of America',
    ]);
  });

  it('uses null for a missing capital and area, and [] for missing borders', () => {
    const [country] = mapCountryResponse([pick(unitedRaw, 'UMI')]);

    expect(country).toMatchObject({
      code: 'UMI',
      capital: null,
      area: null,
      borders: [],
      independent: false,
      population: 300,
    });
  });

  it('maps every language to its name', () => {
    const [country] = mapCountryResponse([pick(unitedRaw, 'TZA')]);

    expect(country?.languages).toEqual(['Swahili', 'English']);
  });

  it('formats currencies as "name (symbol)"', () => {
    const [country] = mapCountryResponse([pick(unitedRaw, 'USA')]);

    expect(country?.currencies).toEqual(['United States dollar ($)']);
  });

  it('keeps a capital that contains a comma intact', () => {
    const [country] = mapCountryResponse([pick(unitedRaw, 'USA')]);

    expect(country?.capital).toBe('Washington, D.C.');
  });

  it('does not mutate the input', () => {
    const before = structuredClone(unitedRaw);

    mapCountryResponse(unitedRaw);

    expect(unitedRaw).toEqual(before);
  });
});
