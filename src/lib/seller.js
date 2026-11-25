// Seller identification used on the legal pages and on the printed sample leaflets.
// Values in [brackets] are still missing: the legal pages highlight them and the
// leaflet printer warns before printing.
export const seller = {
  name: "[Jméno a příjmení / název firmy]",
  ico: "[IČO]",
  address: "[Ulice a č. p., PSČ Město]",
  register: "[Fyzická osoba podnikající dle živnostenského zákona, zapsaná v živnostenském rejstříku]",
  vat: "[Není plátcem DPH]",
  email: "[kontaktní e-mail]",
  phone: "[telefon]",
};

export const isMissing = (value) => String(value).startsWith("[");
