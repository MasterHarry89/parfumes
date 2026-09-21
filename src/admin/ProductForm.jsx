import { useEffect, useState } from "react";
import { FiCheck, FiImage, FiX } from "react-icons/fi";

import { supabase } from "../lib/supabase";
import {
  familyOptions,
  computePricing,
  genderOptions,
  money,
  occasionOptions,
  parseNumber,
  priceFor,
  sampleVolumes,
  seasonOptions,
  slugify,
  tagList,
  tagOptions,
  toList,
  toStored,
} from "../lib/catalog";
import { recordExpense } from "./expenses";
import PricingTable from "./PricingTable";

const emptyForm = {
  name: "",
  brand: "",
  id: "",
  note: "",
  description: "",
  tags: ["Novinka"],
  gender: "",
  image: "",
  bottle: "",
  stock: "",
  purchase: "",
  bookExpense: true,
  margin: "60",
  priceInputs: {},
  families: [],
  seasons: [],
  occasions: [],
  notesTop: [],
  notesHeart: [],
  notesBase: [],
  longevity: null,
  active: true,
};

const IMAGE_BUCKET = "product-images";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1600;

// Shrinks a photo to at most 1600 px and re-encodes it as WebP so a 6 MB phone
// picture becomes a few hundred KB. Falls back to the original file.
const prepareImage = async (file) => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    return blob && blob.type === "image/webp" ? blob : file;
  } catch {
    return file;
  }
};

const extensionFor = (blob) => (blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg");

const toggle = (list, key) =>
  list.includes(key) ? list.filter((item) => item !== key) : [...list, key];

function Field({ label, hint, children, wide }) {
  return (
    <label className={`pf-field ${wide ? "pf-wide" : ""}`}>
      <span className="pf-label">{label}</span>
      {children}
      {hint && <small className="pf-hint">{hint}</small>}
    </label>
  );
}

function Card({ title, description, children }) {
  return (
    <section className="pf-card">
      <header>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}

function ChipToggles({ options, selected, onChange, legend }) {
  return (
    <div className="pf-chips" role="group" aria-label={legend}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            type="button"
            key={option}
            className={on ? "is-on" : ""}
            aria-pressed={on}
            onClick={() => onChange(toggle(selected, option))}
          >
            {on && <FiCheck aria-hidden="true" />}
            {option}
          </button>
        );
      })}
    </div>
  );
}

function TileToggles({ options, selected, onChange, legend }) {
  return (
    <div className="pf-tiles" role="group" aria-label={legend}>
      {options.map(({ key, label, icon: Icon }) => {
        const on = selected.includes(key);
        return (
          <button
            type="button"
            key={key}
            className={on ? "is-on" : ""}
            aria-pressed={on}
            onClick={() => onChange(toggle(selected, key))}
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function TagInput({ label, values, onChange, placeholder }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const value = draft.trim().replace(/,$/, "").trim();
    setDraft("");
    if (value && !values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value]);
    }
  };

  return (
    <div className="pf-field">
      <span className="pf-label">{label}</span>
      <div className="pf-taginput">
        {values.map((value) => (
          <span className="pf-tag" key={value}>
            {value}
            <button
              type="button"
              aria-label={`Odebrat ${value}`}
              onClick={() => onChange(values.filter((v) => v !== value))}
            >
              <FiX aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={values.length ? "" : placeholder}
          aria-label={label}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            } else if (event.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
        />
      </div>
    </div>
  );
}

// Form values for an existing product row (edit mode). Prices start as the ones in the shop.
const formFromProduct = (product) => {
  const priced = {
    price: Number(product.price || 0),
    prices: product.prices && typeof product.prices === "object" ? product.prices : {},
  };
  return {
    ...emptyForm,
    name: product.name ?? "",
    brand: product.brand ?? "",
    id: product.id,
    note: product.note ?? "",
    description: product.description ?? "",
    tags: tagList(product.tag).filter((tag) => tagOptions.includes(tag)),
    gender: product.gender ?? "",
    image: product.image ?? "",
    families: toList(product.families),
    seasons: toList(product.seasons),
    occasions: toList(product.occasions),
    notesTop: toList(product.notes_top),
    notesHeart: toList(product.notes_heart),
    notesBase: toList(product.notes_base),
    longevity: product.longevity ?? null,
    active: product.active !== false,
    priceInputs: Object.fromEntries(
      sampleVolumes.map((volume) => [volume.value, String(priceFor(priced, volume) / 10)]),
    ),
  };
};

// Badges that are not one of the two tickable ones (e.g. an older "Oblíbené") are kept as they are.
const extraTags = (product) => tagList(product?.tag).filter((tag) => !tagOptions.includes(tag));

// Path of a file in our photo bucket, or null for photos hosted elsewhere.
const storagePathOf = (url) => {
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const index = String(url || "").indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
};

function ProductForm({
  product = null,
  inventoryCostPerMl = null,
  existingIds,
  materials,
  labourPerSample,
  onSaved,
  onOpenProduct,
  onBack,
}) {
  const editing = product !== null;
  const [form, setForm] = useState(() => (editing ? formFromProduct(product) : emptyForm));
  const [idTouched, setIdTouched] = useState(false);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const id = editing ? product.id : idTouched ? form.id : slugify(form.name);
  // The price covers the whole bottle; only `stockMl` of it goes on the shelf (default: all of it).
  const bottleMl = parseNumber(form.bottle);
  const stockMl = form.stock !== "" ? parseNumber(form.stock) : bottleMl > 0 ? bottleMl : 0;
  const costBasisMl = bottleMl > 0 ? bottleMl : stockMl;
  const purchaseKc = parseNumber(form.purchase);
  const marginTarget = parseNumber(form.margin);
  // Perfume purchase cost per ml, in tenths of CZK (null until both numbers are filled in).
  // When editing, the cost comes from the stock (change it there with "Doskladnit").
  const costPerMl = editing
    ? inventoryCostPerMl
    : costBasisMl > 0 && form.purchase !== "" && purchaseKc >= 0
      ? (purchaseKc * 10) / costBasisMl
      : null;

  const pricing = computePricing({
    costPerMl,
    materials,
    labourPerSample,
    marginTarget,
    priceInputs: form.priceInputs,
  });
  const price1 = pricing[0].price;

  const pickImage = (file) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setErrors(["Fotka musí být ve formátu JPG, PNG nebo WebP."]);
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setErrors(["Fotka je příliš velká (maximum je 15 MB)."]);
      return;
    }
    setErrors([]);
    setImageFile(file);
  };

  const validate = () => {
    const problems = [];
    if (!form.name.trim()) problems.push("Vyplňte název vůně.");
    if (!form.brand.trim()) problems.push("Vyplňte značku.");
    if (!form.gender) problems.push("Vyberte, jestli je vůně pánská, dámská nebo unisex.");
    if (!editing) {
      if (!id) problems.push("Adresa produktu nesmí být prázdná.");
      else if (existingIds.includes(id))
        problems.push(`Produkt s adresou „${id}“ už existuje. Upravte název nebo adresu.`);
      if (form.bottle !== "" && !(bottleMl > 0))
        problems.push("Velikost flakonu musí být číslo větší než 0.");
      if (!(stockMl >= 0)) problems.push("Množství ke skladování musí být číslo od 0.");
      if (bottleMl > 0 && stockMl > bottleMl)
        problems.push("Naskladňujete víc ml, než kolik má koupený flakon.");
      if (form.purchase !== "" && !(purchaseKc >= 0))
        problems.push("Nákupní cena musí být číslo od 0.");
    }
    pricing.forEach((row) => {
      if (row.price === null)
        problems.push(`Zadejte prodejní cenu pro ${row.volume.label} vyšší než 0 Kč.`);
    });
    return problems;
  };

  const save = async (event) => {
    event.preventDefault();
    const problems = validate();
    setErrors(problems);
    if (problems.length) return;

    setSaving(true);
    let imageUrl = form.image.trim() || null;
    let uploadedPath = null;
    if (imageFile) {
      const blob = await prepareImage(imageFile);
      uploadedPath = `${id}-${Date.now()}.${extensionFor(blob)}`;
      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(uploadedPath, blob, {
          contentType: blob.type,
          cacheControl: "31536000",
        });
      if (uploadError) {
        setErrors([
          /not found/i.test(uploadError.message)
            ? "Úložiště fotek ještě není vytvořené. Spusťte supabase/product-images.sql."
            : `Fotku se nepodařilo nahrát: ${uploadError.message}`,
        ]);
        setSaving(false);
        return;
      }
      imageUrl = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(uploadedPath)
        .data.publicUrl;
    }

    const productRow = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      family: form.families.join(", ") || null,
      families: form.families,
      price: price1,
      prices: Object.fromEntries(pricing.map((row) => [row.volume.value, row.price])),
      image: imageUrl,
      note: form.note.trim() || null,
      description: form.description.trim() || null,
      tag: [...form.tags, ...(editing ? extraTags(product) : [])].join(", ") || null,
      gender: form.gender,
      active: form.active,
      notes_top: form.notesTop,
      notes_heart: form.notesHeart,
      notes_base: form.notesBase,
      longevity: form.longevity,
      seasons: form.seasons,
      occasions: form.occasions,
    };
    const { error: productError } = editing
      ? await supabase.from("products").update(productRow).eq("id", id)
      : await supabase.from("products").insert({ id, ...productRow });

    if (productError) {
      if (uploadedPath) {
        await supabase.storage.from(IMAGE_BUCKET).remove([uploadedPath]);
      }
      setErrors([
        productError.code === "42501"
          ? "Zápis byl odmítnut. Chybí oprávnění pro přihlášeného uživatele (viz supabase/product-form.sql)."
          : productError.code === "23505"
            ? `Produkt s adresou „${id}“ už existuje.`
            : /gender/.test(productError.message)
              ? "Databáze ještě nemá sloupec „Pro koho“. Spusťte supabase/product-gender.sql."
            : /prices/.test(productError.message)
              ? "Databáze ještě nemá sloupec pro ceny velikostí. Spusťte supabase/pricing.sql."
              : `Produkt se nepodařilo uložit: ${productError.message}`,
      ]);
      setSaving(false);
      return;
    }

    if (editing) {
      // The old photo is deleted only after the new state has been saved.
      const oldPath = storagePathOf(product.image);
      if (oldPath && imageUrl !== product.image) {
        await supabase.storage.from(IMAGE_BUCKET).remove([oldPath]);
      }
      await onSaved();
      setSaving(false);
      setErrors([]);
      setSavedId(id);
      return;
    }

    const { error: stockError } = await supabase.from("inventory").insert({
      product_id: id,
      stock_ml: stockMl,
      cost_per_ml: costPerMl === null ? 0 : Math.round(costPerMl),
    });

    const warnings = [];
    if (stockError) {
      warnings.push(`Produkt je uložený, ale sklad se nepodařilo založit: ${stockError.message}`);
    } else if (purchaseKc > 0 && form.bookExpense) {
      // The whole purchase is the expense, even when only part of the bottle is stocked.
      const expenseError = await recordExpense({
        category: "perfume",
        label: `${form.brand.trim()} ${form.name.trim()} (${costBasisMl} ml)`,
        amount: toStored(purchaseKc),
        productId: id,
      });
      if (expenseError) warnings.push(expenseError);
    }

    await onSaved();
    setSaving(false);
    setErrors(warnings);
    setSavedId(id);
  };

  if (savedId) {
    return (
      <div className="adm-page">
        <section className="pf-card pf-done">
          <span className="pf-done-icon">
            <FiCheck aria-hidden="true" />
          </span>
          <h2>{editing ? "Změny byly uloženy" : "Produkt byl uložen"}</h2>
          <p>
            <strong>
              {form.brand} {form.name}
            </strong>{" "}
            {editing ? "je upravený" : "je v databázi"}
            {form.active ? " a je vidět v e-shopu" : ", ale je skrytý"}.
          </p>
          {errors.map((error) => (
            <p className="pf-error" role="alert" key={error}>
              {error}
            </p>
          ))}
          <div className="pf-done-actions">
            <button className="pf-save" onClick={() => onOpenProduct(savedId)}>
              Zobrazit na webu
            </button>
            {editing ? (
              <button className="pf-secondary" onClick={onBack}>
                Zpět na produkty
              </button>
            ) : (
              <button
                className="pf-secondary"
                onClick={() => {
                  setForm(emptyForm);
                  setImageFile(null);
                  setIdTouched(false);
                  setErrors([]);
                  setSavedId(null);
                }}
              >
                Přidat další produkt
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <form className="adm-page pf" onSubmit={save} noValidate>
      <div className="pf-layout">
        <div className="pf-main">
          <Card title="Základní údaje">
            <div className="pf-grid">
              <Field label="Název vůně *">
                <input
                  value={form.name}
                  onChange={(event) => set({ name: event.target.value })}
                  placeholder="Santal 33"
                />
              </Field>
              <Field label="Značka *">
                <input
                  value={form.brand}
                  onChange={(event) => set({ brand: event.target.value })}
                  placeholder="Le Labo"
                />
              </Field>
              <Field
                label="Adresa produktu"
                hint={
                  editing
                    ? "Adresu produktu nelze změnit, je spojená se skladem a odkazy."
                    : "Vytvoří se z názvu, můžete ji upravit."
                }
                wide
              >
                <span className="pf-prefix">
                  <span>/produkt/</span>
                  <input
                    value={id}
                    readOnly={editing}
                    onChange={(event) => {
                      setIdTouched(true);
                      set({ id: slugify(event.target.value) });
                    }}
                    placeholder="santal-33"
                  />
                </span>
              </Field>
              <div className="pf-field pf-wide">
                <span className="pf-label">Pro koho *</span>
                <div className="pf-segment" role="group" aria-label="Pro koho je vůně">
                  {genderOptions.map((option) => (
                    <button
                      type="button"
                      key={option.key}
                      className={form.gender === option.key ? "is-on" : ""}
                      aria-pressed={form.gender === option.key}
                      onClick={() => set({ gender: option.key })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <Field
                label="Krátký popis"
                hint="Zobrazí se pod názvem, např. „suché dřevo · kardamom · kůže“."
                wide
              >
                <input
                  value={form.note}
                  onChange={(event) => set({ note: event.target.value })}
                />
              </Field>
              <Field label="Popis produktu" wide>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => set({ description: event.target.value })}
                />
              </Field>
            </div>
          </Card>

          <Card
            title="Fotka"
            description="JPG, PNG nebo WebP. Fotka se před nahráním automaticky zmenší."
          >
            {previewUrl || form.image ? (
              <div className="pf-photo">
                <img src={previewUrl || form.image} alt="" />
                <div>
                  <strong>{imageFile ? imageFile.name : editing ? "Aktuální fotka" : "Fotka z odkazu"}</strong>
                  <div className="pf-photo-actions">
                    <label className="pf-secondary pf-small">
                      Změnit
                      <input
                        type="file"
                        accept={IMAGE_TYPES.join(",")}
                        hidden
                        onChange={(event) => {
                          pickImage(event.target.files[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="pf-secondary pf-small"
                      onClick={() => {
                        setImageFile(null);
                        set({ image: "" });
                      }}
                    >
                      Odebrat
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                className={`pf-drop ${dragging ? "is-over" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  pickImage(event.dataTransfer.files[0]);
                }}
              >
                <FiImage aria-hidden="true" />
                <strong>Přetáhněte fotku sem</strong>
                <span>nebo klikněte a vyberte soubor</span>
                <input
                  type="file"
                  accept={IMAGE_TYPES.join(",")}
                  hidden
                  onChange={(event) => {
                    pickImage(event.target.files[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
            {!imageFile && (
              <Field
                label="Nebo vložte odkaz na obrázek"
                hint="Bez fotky se použije výchozí obrázek."
              >
                <input
                  type="url"
                  value={form.image}
                  onChange={(event) => set({ image: event.target.value })}
                  placeholder="https://…"
                />
              </Field>
            )}
          </Card>

{editing ? (
          <Card
            title="Ceny velikostí"
            description={
              costPerMl === null
                ? "Tento produkt nemá ve skladu zadaný náklad, proto se marže nepočítá. Ceny můžete upravit ručně."
                : `Náklad vychází ze skladu (${money(costPerMl)} za ml) a z obalu. Množství a nový nákup změníte na stránce Sklad a ceny tlačítkem Doskladnit.`
            }
          >
            <div className="pf-grid pf-grid-3">
              <Field label="Cílová marže (%)" hint="Z ní se počítají doporučené ceny.">
                <input
                  inputMode="decimal"
                  value={form.margin}
                  onChange={(event) => set({ margin: event.target.value })}
                />
              </Field>
            </div>
            <PricingTable
              rows={pricing}
              priceInputs={form.priceInputs}
              onChange={(priceInputs) => set({ priceInputs })}
              materialCount={materials.length}
            />
          </Card>
          ) : (
          <Card
            title="Naskladnění a cenotvorba"
            description="Zadejte, jak velký flakon jste koupili a za kolik, a kolik z něj naskladňujete. Ceny velikostí se dopočítají a můžete je přepsat."
          >
            <div className="pf-grid pf-grid-3">
              <Field label="Velikost koupeného flakonu (ml)" hint="Podle ní se počítá cena za ml.">
                <input
                  inputMode="decimal"
                  value={form.bottle}
                  onChange={(event) => set({ bottle: event.target.value })}
                  placeholder="75"
                />
              </Field>
              <Field label="Nákupní cena celkem (Kč)">
                <input
                  inputMode="decimal"
                  value={form.purchase}
                  onChange={(event) => set({ purchase: event.target.value })}
                  placeholder="5000"
                />
              </Field>
              <Field label="Cena za 1 ml (vychází)">
                <output className="pf-readout">
                  {costPerMl === null ? "—" : money(costPerMl)}
                </output>
              </Field>
            </div>

            <div className="pf-grid pf-grid-3 pf-spaced-block">
              <Field
                label="Naskladnit (ml)"
                hint="Prázdné pole = celý flakon. Zbytek nemusíte nikde evidovat, sklad jde kdykoli upravit."
              >
                <input
                  inputMode="decimal"
                  value={form.stock}
                  onChange={(event) => set({ stock: event.target.value })}
                  placeholder={form.bottle || "75"}
                />
              </Field>
              <div className="pf-field pf-span-2">
                <label className="pf-switch pf-switch-top">
                  <input
                    type="checkbox"
                    checked={form.bookExpense}
                    onChange={(event) => set({ bookExpense: event.target.checked })}
                  />
                  <span>
                    Zapsat nákup do výdajů{purchaseKc > 0 ? ` (${money(toStored(purchaseKc))})` : ""}
                  </span>
                </label>
                <small className="pf-hint">
                  Vypněte, pokud vůni už máte a nákup nechcete v účetnictví. Cena za ml se do nákladů na vzorek
                  započítá tak jako tak.
                </small>
              </div>
            </div>

            <div className="pf-grid pf-grid-3 pf-spaced-block">
              <Field label="Cílová marže (%)" hint="Z ní se počítají doporučené ceny.">
                <input
                  inputMode="decimal"
                  value={form.margin}
                  onChange={(event) => set({ margin: event.target.value })}
                />
              </Field>
            </div>

            <PricingTable
              rows={pricing}
              priceInputs={form.priceInputs}
              onChange={(priceInputs) => set({ priceInputs })}
              materialCount={materials.length}
            />
          </Card>
          )}

          <Card
            title="Parfémové rodiny"
            description="Vyberte všechny, které vůni vystihují."
          >
            <ChipToggles
              legend="Parfémové rodiny"
              options={familyOptions}
              selected={form.families}
              onChange={(families) => set({ families })}
            />
          </Card>

          <Card title="Roční období a příležitosti">
            <span className="pf-label">Vhodné roční období</span>
            <TileToggles
              legend="Roční období"
              options={seasonOptions}
              selected={form.seasons}
              onChange={(seasons) => set({ seasons })}
            />
            <span className="pf-label pf-spaced">Vhodné k příležitosti</span>
            <TileToggles
              legend="Příležitosti"
              options={occasionOptions}
              selected={form.occasions}
              onChange={(occasions) => set({ occasions })}
            />
          </Card>

          <Card
            title="Složky a výdrž"
            description="Složky potvrďte klávesou Enter nebo čárkou."
          >
            <div className="pf-grid">
              <TagInput
                label="Vrchní složky"
                values={form.notesTop}
                onChange={(notesTop) => set({ notesTop })}
                placeholder="Bergamot, zázvor…"
              />
              <TagInput
                label="Srdcové složky"
                values={form.notesHeart}
                onChange={(notesHeart) => set({ notesHeart })}
                placeholder="Iris, ambroxan…"
              />
              <TagInput
                label="Základní složky"
                values={form.notesBase}
                onChange={(notesBase) => set({ notesBase })}
                placeholder="Santalové dřevo, vanilka…"
              />
            </div>
            <span className="pf-label pf-spaced">
              Výdrž parfému{form.longevity ? `: ${form.longevity}/10` : ""}
            </span>
            <div className="pf-scale" role="group" aria-label="Výdrž parfému">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((n) => (
                <button
                  type="button"
                  key={n}
                  className={form.longevity && n <= form.longevity ? "is-on" : ""}
                  aria-pressed={form.longevity === n}
                  onClick={() => set({ longevity: form.longevity === n ? null : n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="pf-scale-legend">
              <span>Slabá</span>
              <span>Silná</span>
            </div>
          </Card>
        </div>

        <aside className="pf-side">
          <div className="pf-card pf-preview">
            <span className="pf-label">Náhled na kartě</span>
            <div className="pf-preview-image">
              {previewUrl || form.image ? (
                <img src={previewUrl || form.image} alt="" />
              ) : (
                <span>Bez fotky</span>
              )}
              {form.tags.length > 0 && (
                <div className="pf-preview-tags">
                  {form.tags.map((tag) => (
                    <b key={tag}>{tag}</b>
                  ))}
                </div>
              )}
            </div>
            <strong>
              {form.brand || "Značka"} {form.name || "Název vůně"}
            </strong>
            <span>od {price1 !== null ? money(price1) : "—"}</span>
          </div>

          <div className="pf-card">
            <span className="pf-label">Štítky (lze zaškrtnout oba)</span>
            <div className="pf-chips" role="group" aria-label="Štítky">
              {tagOptions.map((tag) => {
                const on = form.tags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    className={on ? "is-on" : ""}
                    aria-pressed={on}
                    onClick={() =>
                      set({ tags: on ? form.tags.filter((item) => item !== tag) : [...form.tags, tag] })
                    }
                  >
                    {on && <FiCheck aria-hidden="true" />}
                    {tag}
                  </button>
                );
              })}
            </div>
            <label className="pf-switch">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => set({ active: event.target.checked })}
              />
              <span>Zobrazit v e-shopu</span>
            </label>
          </div>

          {errors.length > 0 && (
            <div className="pf-error" role="alert">
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <button className="pf-save" disabled={saving}>
            {saving ? "Ukládám…" : editing ? "Uložit změny" : "Uložit produkt"}
          </button>
        </aside>
      </div>
    </form>
  );
}

export default ProductForm;
