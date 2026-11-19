export interface RawCurrency {
  code: string;
  name: string;
  symbol: string;
}

export interface RawLanguage {
  name: string;
  iso639_1: string;
  iso639_2: string;
  nativeName: string;
}

export interface RawCountry {
  name: string;
  nativeName: string;
  alpha2Code: string;
  alpha3Code: string;
  flag: string;
  flags: { png: string; svg: string };
  region: string;
  subregion: string;
  population: number;
  independent: boolean;
  demonym: string;
  languages: RawLanguage[];
  currencies: RawCurrency[];
  capital?: string;
  area?: number;
  borders?: string[];
}

export interface Country {
  code: string;
  name: string;
  nativeName: string;
  demonym: string;
  independent: boolean;
  flagUrl: string;
  capital: string | null;
  region: string;
  subregion: string;
  population: number;
  area: number | null;
  borders: string[];
  languages: string[];
  currencies: string[];
}
