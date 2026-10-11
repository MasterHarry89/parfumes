import { useState } from "react";

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
};
const orderErrorMessage = (error) =>
  orderErrors[Object.keys(orderErrors).find((code) => error.message?.includes(code))] ??
  "Objednávku se nepodařilo odeslat. Zkuste to prosím znovu.";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);

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
  const shippingPrice = shippingPriceFor(shippingMethod, subtotal);
  const total = subtotal + shippingPrice + paymentMethod.fee;
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
        items: cart.map((item) => ({
          product_id: item.id,
          volume: parseInt(item.volume, 10),
          quantity: item.quantity,
        })),
      },
    });
    setBusy(false);
    if (placeError) {
      setError(orderErrorMessage(placeError));
      return;
    }
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
      <form className="checkout-grid" onSubmit={submit}>
        <div className="checkout-steps">
          <section className="checkout-step">
            <h2>
              <span>1</span> Kontaktní údaje
            </h2>
            <div className="checkout-fields">
              <Field label="Jméno a příjmení" wide>
                <input required autoComplete="name" value={contact.name} onChange={setContactField("name")} />
              </Field>
              <Field label="E-mail">
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={contact.email}
                  onChange={setContactField("email")}
                />
              </Field>
              <Field label="Telefon">
                <input
                  required
                  type="tel"
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
                <button type="button" onClick={() => navigate("/ucet")}>
                  Přihlaste se
                </button>{" "}
                a za nákup získáte body.
              </p>
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
                const price = shippingPriceFor(method, subtotal);
                return price ? money(price) : "Zdarma";
              }}
            />
            {shipping === "packeta_point" && <PickupPoint point={point} onChange={setPoint} />}
            {shipping === "packeta_home" && (
              <div className="checkout-fields">
                <Field label="Ulice a číslo popisné" wide>
                  <input
                    required
                    autoComplete="street-address"
                    value={address.street}
                    onChange={setAddressField("street")}
                  />
                </Field>
                <Field label="Město">
                  <input
                    required
                    autoComplete="address-level2"
                    value={address.city}
                    onChange={setAddressField("city")}
                  />
                </Field>
                <Field label="PSČ">
                  <input
                    required
                    autoComplete="postal-code"
                    inputMode="numeric"
                    value={address.zip}
                    onChange={setAddressField("zip")}
                  />
                </Field>
              </div>
            )}
            {subtotal < FREE_SHIPPING_FROM && (
              <p className="checkout-hint">
                Do dopravy zdarma vám chybí {money(FREE_SHIPPING_FROM - subtotal)}.
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
              <textarea rows={3} value={contact.note} onChange={setContactField("note")} />
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
          <dl>
            <div>
              <dt>Mezisoučet</dt>
              <dd>{money(subtotal)}</dd>
            </div>
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
            Odesláním objednávky souhlasíte s obchodními podmínkami.
          </small>
        </aside>
      </form>
    </main>
  );
}
