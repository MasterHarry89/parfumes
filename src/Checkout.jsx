import { useEffect, useRef, useState } from "react";

import { supabase } from "./lib/supabase";
import { navigate } from "./lib/navigate";
import { money } from "./lib/catalog";
import {
  FREE_SHIPPING_FROM,
  bankAccount,
  packetaApiKey,
  paymentMethods,
  pickPacketaPoint,
  shippingMethods,
  shippingPriceFor,
  startCardPayment,
} from "./lib/checkout";
import { discountErrorMessage, discountValueLabel, isValidCode, normalizeCode } from "./lib/discounts";
import { detailsFromOrder, forgetDetails, loadSavedDetails, saveDetails } from "./lib/savedCheckout";

// Messages for the exceptions raised by public.place_order().
const orderErrors = {
  missing_name: "Vyplňte prosím jméno a příjmení.",
  invalid_email: "Zkontrolujte prosím e-mail.",
  empty_cart: "Košík je prázdný.",
  invalid_item: "Některá položka v košíku není platná.",
  unknown_product: "Některá vůně už není v nabídce. Odeberte ji prosím z košíku.",
  missing_point: "Vyberte prosím výdejní místo.",
  missing_address: "Vyplňte prosím doručovací adresu.",
  invalid_shipping: "Vyberte prosím způsob dopravy.",
  invalid_payment: "Vyberte prosím způsob platby.",
  too_many_orders: "Z tohoto e-mailu přišlo za poslední hodinu příliš mnoho objednávek. Zkuste to prosím později.",
  orders_input_size: "Některý údaj je příliš dlouhý. Zkraťte ho prosím.",
};
// A refused discount code arrives as "discount_<reason>", e.g. discount_used_up.
const discountFailure = (error) => error.message?.match(/discount_([a-z_]+)/)?.[1] ?? null;
// "out_of_stock <name>": someone bought the last ml meanwhile.
const stockFailure = (error) => error.message?.match(/out_of_stock\s*(.*)$/)?.[1]?.trim() ?? null;
const orderErrorMessage = (error) =>
  (discountFailure(error) && discountErrorMessage({ error: discountFailure(error) })) ??
  (stockFailure(error) !== null
    ? `Vůni ${stockFailure(error) || ""} už nemáme skladem v požadovaném množství. Upravte prosím košík.`.replace("  ", " ")
    : null) ??
  orderErrors[Object.keys(orderErrors).find((code) => error.message?.includes(code))] ??
  "Objednávku se nepodařilo odeslat. Zkuste to prosím znovu.";

// "Máte slevový kód?" in the summary. The code is checked right away for the
// preview; place_order() checks it again with the real prices.
function DiscountField({ subtotal, email, discount, onChange }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const apply = async () => {
    const code = normalizeCode(text);
    if (!code) return setMessage("Zadejte slevový kód.");
    if (!isValidCode(code)) return setMessage("Tento slevový kód neexistuje.");
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("check_discount", {
      p_code: code,
      p_subtotal: subtotal,
      p_email: email,
    });
    setBusy(false);
    if (error) return setMessage(discountErrorMessage({}));
    if (!data.ok) return setMessage(discountErrorMessage(data));
    onChange(data);
    setText("");
  };

  if (discount)
    return (
      <div className="discount-applied">
        <span>
          Kód <b>{discount.code}</b> · sleva {discountValueLabel(discount.kind, discount.value)}
        </span>
        <button type="button" onClick={() => onChange(null)}>
          Odebrat
        </button>
      </div>
    );

  if (!open)
    return (
      <button type="button" className="discount-toggle" onClick={() => setOpen(true)}>
        Máte slevový kód?
      </button>
    );

  return (
    <div className="discount-field">
      <div className="discount-row">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          // Enter would otherwise submit the whole order form.
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              apply();
            }
          }}
          placeholder="Slevový kód"
          aria-label="Slevový kód"
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
        />
        <button type="button" className="checkout-secondary" onClick={apply} disabled={busy}>
          {busy ? "Ověřuji…" : "Použít"}
        </button>
      </div>
      {message && <p className="checkout-error">{message}</p>}
    </div>
  );
}

function Field({ label, children, wide }) {
  return (
    <label className={`checkout-field ${wide ? "is-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ChoiceList({ name, options, value, onChange, renderPrice }) {
  return (
    <div className="choice-list" role="radiogroup">
      {options.map((option) => (
        <label
          key={option.key}
          className={`choice ${value === option.key ? "is-selected" : ""} ${option.enabled === false ? "is-disabled" : ""}`}
        >
          <input
            type="radio"
            name={name}
            value={option.key}
            checked={value === option.key}
            disabled={option.enabled === false}
            onChange={() => onChange(option.key)}
          />
          <span className="choice-text">
            <strong>{option.label}</strong>
            <small>{option.enabled === false ? "Připravujeme" : option.note}</small>
          </span>
          <b>{renderPrice(option)}</b>
        </label>
      ))}
    </div>
  );
}

function PickupPoint({ point, onChange }) {
  const [error, setError] = useState("");
  if (!packetaApiKey)
    // Until the Zásilkovna API key is set, the point is typed in by hand.
    return (
      <Field label="Výdejní místo Zásilkovny (název a adresa)" wide>
        <input
          required
          maxLength={200}
          value={point?.name ?? ""}
          onChange={(event) => onChange(event.target.value ? { name: event.target.value } : null)}
          placeholder="např. Z-BOX Praha 4, Na Pankráci 12"
        />
      </Field>
    );
  const choose = async () => {
    setError("");
    try {
      const picked = await pickPacketaPoint();
      if (picked) onChange(picked);
    } catch (pickError) {
      setError(pickError.message);
    }
  };
  return (
    <div className="pickup-point">
      {point ? (
        <div>
          <strong>{point.name}</strong>
          <small>
            {[point.street, point.city, point.zip].filter(Boolean).join(", ")}
          </small>
        </div>
      ) : (
        <p>Zatím nemáte vybrané výdejní místo.</p>
      )}
      <button type="button" className="checkout-secondary" onClick={choose}>
        {point ? "Změnit místo" : "Vybrat výdejní místo"}
      </button>
      {error && <p className="checkout-error">{error}</p>}
    </div>
  );
}

function Confirmation({ order }) {
  const [cardError, setCardError] = useState("");
  return (
    <main className="page-shell checkout-page checkout-done">
      <span className="eyebrow">Děkujeme</span>
      <h1>Objednávka č. {order.order_number} byla přijata ke zpracování</h1>
      <p className="checkout-lead">
        Objednávku jsme uložili. Ozveme se vám na <b>{order.email}</b>.
      </p>

      {order.payment === "transfer" && (
        <section className="payment-box">
          <h2>Platební údaje</h2>
          <dl>
            <div>
              <dt>Číslo účtu</dt>
              <dd>{bankAccount || "doplníme v potvrzovacím e-mailu"}</dd>
            </div>
            <div>
              <dt>Variabilní symbol</dt>
              <dd>{order.order_number}</dd>
            </div>
            <div>
              <dt>Částka</dt>
              <dd>{money(Number(order.total))}</dd>
            </div>
          </dl>
          <p>Objednávku odešleme, jakmile k nám platba dorazí.</p>
        </section>
      )}
      {order.payment === "cod" && (
        <section className="payment-box">
          <h2>Platba na dobírku</h2>
          <p>
            Částku <b>{money(Number(order.total))}</b> zaplatíte při převzetí zásilky.
          </p>
        </section>
      )}
      {order.payment === "card" && (
        <section className="payment-box">
          <h2>Platba kartou</h2>
          <button
            className="primary-button"
            onClick={() => startCardPayment(order).catch((error) => setCardError(error.message))}
          >
            Zaplatit {money(Number(order.total))} <span>→</span>
          </button>
          {cardError && <p className="checkout-error">{cardError}</p>}
        </section>
      )}

      <button className="checkout-secondary" onClick={() => navigate("/kolekce")}>
        Pokračovat v nákupu
      </button>
    </main>
  );
}

export default function Checkout({ cart, session, onPlaced }) {
  const [contact, setContact] = useState({
    name: "",
    email: session?.user?.email ?? "",
    phone: "",
    note: "",
  });
  const [address, setAddress] = useState({ street: "", city: "", zip: "" });
  const [shipping, setShipping] = useState(shippingMethods[0].key);
  const [payment, setPayment] = useState(
    paymentMethods.find((method) => method.enabled).key,
  );
  const [point, setPoint] = useState(null);
  const [discount, setDiscount] = useState(null); // check_discount() answer for the applied code
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);
  // Guests opt in to having their details kept in this browser (shared computers!).
  const [remember, setRemember] = useState(() => loadSavedDetails() !== null);
  const edited = useRef(false); // once the customer types, prefilled data never overwrites it
  const userId = session?.user?.id ?? null;

  // Prefill from the customer's latest order, or from this browser for a guest.
  useEffect(() => {
    let cancelled = false;
    const apply = (details) => {
      if (cancelled || !details || edited.current) return;
      setContact((current) => ({
        ...current,
        name: current.name || details.name,
        // A logged-in customer keeps the e-mail of their account.
        email: current.email || details.email,
        phone: current.phone || details.phone,
      }));
      if (details.shipping) setShipping(details.shipping);
      if (details.payment) setPayment(details.payment);
      if (details.point) setPoint(details.point);
      if (details.address) setAddress(details.address);
    };
    if (!userId) {
      apply(loadSavedDetails());
      return () => {
        cancelled = true;
      };
    }
    supabase
      .from("orders")
      .select("customer_name, email, phone, shipping_method, payment_method, shipping_point, shipping_address")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => apply(data?.[0] ? detailsFromOrder(data[0]) : loadSavedDetails()));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleRemember = (next) => {
    setRemember(next);
    // Unticking forgets right away, not only after the next order.
    if (!next) forgetDetails();
  };

  if (placed) return <Confirmation order={placed} />;

  if (!cart.length)
    return (
      <main className="page-shell checkout-page">
        <h1>Pokladna</h1>
        <p className="checkout-lead">Košík je prázdný.</p>
        <button className="primary-button" onClick={() => navigate("/kolekce")}>
          Prozkoumat vzorky <span>→</span>
        </button>
      </main>
    );

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingMethod = shippingMethods.find((method) => method.key === shipping);
  const paymentMethod = paymentMethods.find((method) => method.key === payment);
  // The discount is taken off the goods only; free shipping is judged after it.
  const discountAmount = discount ? Number(discount.amount) : 0;
  const goods = subtotal - discountAmount;
  const shippingPrice = shippingPriceFor(shippingMethod, goods);
  const total = goods + shippingPrice + paymentMethod.fee;
  const setContactField = (field) => (event) =>
    setContact((current) => ({ ...current, [field]: event.target.value }));
  const setAddressField = (field) => (event) =>
    setAddress((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (shipping === "packeta_point" && !point) {
      setError("Vyberte prosím výdejní místo.");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: placeError } = await supabase.rpc("place_order", {
      payload: {
        customer_name: contact.name,
        email: contact.email,
        phone: contact.phone,
        note: contact.note,
        shipping_method: shipping,
        shipping_point: shipping === "packeta_point" ? point : null,
        shipping_address: shipping === "packeta_home" ? address : null,
        payment_method: payment,
        discount_code: discount?.code ?? null,
        items: cart.map((item) => ({
          product_id: item.id,
          volume: parseInt(item.volume, 10),
          quantity: item.quantity,
        })),
      },
    });
    setBusy(false);
    if (placeError) {
      // E.g. the last use was taken meanwhile: drop the code so the totals are right again.
      if (discountFailure(placeError)) setDiscount(null);
      setError(orderErrorMessage(placeError));
      return;
    }
    // Logged-in customers get their details from the last order; only guests who asked are kept locally.
    if (!session && remember)
      saveDetails({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        shipping,
        payment,
        point: shipping === "packeta_point" ? point : null,
        address: shipping === "packeta_home" ? address : null,
      });
    setPlaced({ ...data, email: contact.email, payment });
    onPlaced();
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="page-shell checkout-page">
      <button className="checkout-back" onClick={() => navigate("/kosik")}>
        ← Zpět do košíku
      </button>
      <h1>Pokladna</h1>
      <form
        className="checkout-grid"
        onSubmit={submit}
        onChange={() => {
          edited.current = true;
        }}
      >
        <div className="checkout-steps">
          <section className="checkout-step">
            <h2>
              <span>1</span> Kontaktní údaje
            </h2>
            <div className="checkout-fields">
              <Field label="Jméno a příjmení" wide>
                <input required maxLength={120} autoComplete="name" value={contact.name} onChange={setContactField("name")} />
              </Field>
              <Field label="E-mail">
                <input
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={contact.email}
                  onChange={setContactField("email")}
                />
              </Field>
              <Field label="Telefon">
                <input
                  required
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  value={contact.phone}
                  onChange={setContactField("phone")}
                  placeholder="+420"
                />
              </Field>
            </div>
            {!session && (
              <p className="checkout-hint">
                Máte účet?{" "}
                <button type="button" onClick={() => navigate("/ucet?zpet=pokladna")}>
                  Přihlaste se
                </button>{" "}
                a za nákup získáte body.
              </p>
            )}
            {!session && (
              <label className="checkout-remember">
                <input type="checkbox" checked={remember} onChange={(event) => toggleRemember(event.target.checked)} />
                <span>
                  Zapamatovat mé údaje na tomto zařízení
                  <small>Nezaškrtávejte na sdíleném nebo cizím počítači.</small>
                </span>
              </label>
            )}
          </section>

          <section className="checkout-step">
            <h2>
              <span>2</span> Doprava
            </h2>
            <ChoiceList
              name="shipping"
              options={shippingMethods}
              value={shipping}
              onChange={setShipping}
              renderPrice={(method) => {
                const price = shippingPriceFor(method, goods);
                return price ? money(price) : "Zdarma";
              }}
            />
            {shipping === "packeta_point" && <PickupPoint point={point} onChange={setPoint} />}
            {shipping === "packeta_home" && (
              <div className="checkout-fields">
                <Field label="Ulice a číslo popisné" wide>
                  <input
                    required
                    maxLength={120}
                    autoComplete="street-address"
                    value={address.street}
                    onChange={setAddressField("street")}
                  />
                </Field>
                <Field label="Město">
                  <input
                    required
                    maxLength={80}
                    autoComplete="address-level2"
                    value={address.city}
                    onChange={setAddressField("city")}
                  />
                </Field>
                <Field label="PSČ">
                  <input
                    required
                    maxLength={10}
                    autoComplete="postal-code"
                    inputMode="numeric"
                    value={address.zip}
                    onChange={setAddressField("zip")}
                  />
                </Field>
              </div>
            )}
            {goods < FREE_SHIPPING_FROM && (
              <p className="checkout-hint">
                Do dopravy zdarma vám chybí {money(FREE_SHIPPING_FROM - goods)}.
              </p>
            )}
          </section>

          <section className="checkout-step">
            <h2>
              <span>3</span> Platba
            </h2>
            <ChoiceList
              name="payment"
              options={paymentMethods}
              value={payment}
              onChange={setPayment}
              renderPrice={(method) => (method.fee ? `+ ${money(method.fee)}` : "Zdarma")}
            />
          </section>

          <section className="checkout-step">
            <Field label="Poznámka k objednávce (nepovinné)" wide>
              <textarea rows={3} maxLength={1000} value={contact.note} onChange={setContactField("note")} />
            </Field>
          </section>
        </div>

        <aside className="checkout-summary">
          <h2>Shrnutí</h2>
          <ul>
            {cart.map((item) => (
              <li key={item.key}>
                <img src={item.image} alt="" />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.brand} · {item.volume}
                    {item.quantity > 1 ? ` · ${item.quantity} ks` : ""}
                  </small>
                </span>
                <b>{money(item.price * item.quantity)}</b>
              </li>
            ))}
          </ul>
          <DiscountField subtotal={subtotal} email={contact.email} discount={discount} onChange={setDiscount} />
          <dl>
            <div>
              <dt>Mezisoučet</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            {discountAmount > 0 && (
              <div className="checkout-discount">
                <dt>Sleva {discount.code}</dt>
                <dd>−{money(discountAmount)}</dd>
              </div>
            )}
            <div>
              <dt>Doprava</dt>
              <dd>{shippingPrice ? money(shippingPrice) : "Zdarma"}</dd>
            </div>
            {paymentMethod.fee > 0 && (
              <div>
                <dt>{paymentMethod.label}</dt>
                <dd>{money(paymentMethod.fee)}</dd>
              </div>
            )}
            <div className="checkout-total">
              <dt>Celkem</dt>
              <dd>{money(total)}</dd>
            </div>
          </dl>
          {error && <p className="checkout-error">{error}</p>}
          <button className="primary-button" disabled={busy}>
            {busy ? "Odesílám…" : "Objednat s povinností platby"} <span>→</span>
          </button>
          <small className="checkout-terms">
            Odesláním objednávky souhlasíte s{" "}
            <a href="/obchodni-podminky" target="_blank" rel="noreferrer">
              obchodními podmínkami
            </a>
            . Informace o zpracování osobních údajů najdete v{" "}
            <a href="/ochrana-osobnich-udaju" target="_blank" rel="noreferrer">
              zásadách ochrany osobních údajů
            </a>
            .
          </small>
        </aside>
      </form>
    </main>
  );
}
