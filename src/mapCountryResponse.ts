import type { Country, RawCountry } from './types.js';

function mapCountry(raw: RawCountry): Country {
  return {
    code: raw.alpha3Code,
    name: raw.name,
    nativeName: raw.nativeName,
    demonym: raw.demonym,
    independent: raw.independent,
    flagUrl: raw.flags.svg,
    capital: raw.capital ?? null,
    region: raw.region,
    subregion: raw.subregion,
    population: raw.population,
    area: raw.area ?? null,
    borders: raw.borders ? [...raw.borders] : [],
    languages: raw.languages.map((language) => language.name),
    currencies: raw.currencies.map(
      (currency) => `${currency.name} (${currency.symbol})`,
    ),
  };
}

export function mapCountryResponse(raw: RawCountry[]): Country[] {
  return raw.map((country) => mapCountry(country));
}
