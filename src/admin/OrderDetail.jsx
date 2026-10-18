import { useState } from "react";
import { FiArrowLeft, FiMail, FiMapPin, FiPhone } from "react-icons/fi";

import { money, orderPoints, orderStatusInfo } from "../lib/catalog";
import { paymentMethods, shippingMethods } from "../lib/checkout";
import { navigate } from "../lib/navigate";
import { packetStatusLabel } from "./packetaApi";
import { Panel, orderLabel } from "./views";

// The order life cycle the admin moves through. "Zaplaceno" and later count as
// revenue and earn the customer points; "Zrušeno" takes them back.
const statusSteps = ["pending", "paid", "shipped", "completed", "cancelled"];

const methodLabel = (methods, key) =>
  methods.find((method) => method.key === key)?.label ?? key ?? "—";

export default function OrderDetail({ order, onSaveStatus }) {
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");

  const changeStatus = async (status) => {
    if (status === order.status) return;
    if (status === "cancelled" && !window.confirm("Opravdu zrušit tuto objednávku?")) return;
    setSaving(status);
    setError((await onSaveStatus(order.id, status)) ?? "");
    setSaving(null);
  };

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const point = order.shippingPoint;
  const address = order.shippingAddress;
  const points = orderPoints(order);

  return (
    <div className="adm-page">
      <button className="adm-link" onClick={() => navigate("/admin/objednavky")}>
        <FiArrowLeft aria-hidden="true" /> Zpět na objednávky
      </button>

      <Panel title="Stav objednávky" eyebrow={`${orderLabel(order)} · ${order.date}`}>
        <div className="adm-status-steps" role="group" aria-label="Změnit stav">
          {statusSteps.map((status) => {
            const [label, tone] = orderStatusInfo(status);
            const current = order.status === status;
            return (
              <button
                key={status}
                className={`adm-status-step adm-status-${tone} ${current ? "is-current" : ""}`}
                aria-pressed={current}
                disabled={saving !== null}
                onClick={() => changeStatus(status)}
              >
                {saving === status ? "Ukládám…" : label}
              </button>
            );
          })}
        </div>
        {error && (
          <p className="adm-alert" role="alert">
            {error}
          </p>
        )}
        <p className="adm-muted-text adm-spaced-top">
          {order.userId
            ? points > 0
              ? `Zákazník za objednávku získal ${points} bodů.`
              : "Body se zákazníkovi připíšou, až objednávku označíte jako zaplacenou."
            : "Objednávka bez zákaznického účtu – body se nepřipisují."}
        </p>
      </Panel>

      <div className="adm-grid-2">
        <Panel title="Zákazník">
          <dl className="adm-dl">
            <div>
              <dt>Jméno</dt>
              <dd>{order.customer}</dd>
            </div>
            <div>
              <dt>
                <FiMail aria-hidden="true" /> E-mail
              </dt>
              <dd>{order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : "—"}</dd>
            </div>
            <div>
              <dt>
                <FiPhone aria-hidden="true" /> Telefon
              </dt>
              <dd>{order.phone ? <a href={`tel:${order.phone}`}>{order.phone}</a> : "—"}</dd>
            </div>
            {order.note && (
              <div>
                <dt>Poznámka</dt>
                <dd>{order.note}</dd>
              </div>
            )}
          </dl>
        </Panel>

        <Panel title="Doprava a platba">
          <dl className="adm-dl">
            <div>
              <dt>Doprava</dt>
              <dd>{methodLabel(shippingMethods, order.shippingMethod)}</dd>
            </div>
            {point && (
              <div>
                <dt>
                  <FiMapPin aria-hidden="true" /> Výdejní místo
                </dt>
                <dd>
                  {point.name}
                  {point.id && <small className="adm-sub">ID místa: {point.id}</small>}
                </dd>
              </div>
            )}
            {address && (
              <div>
                <dt>
                  <FiMapPin aria-hidden="true" /> Adresa
                </dt>
                <dd>
                  {address.street}
                  <small className="adm-sub">
                    {address.zip} {address.city}
                  </small>
                </dd>
              </div>
            )}
            {order.barcode && (
              <div>
                <dt>Zásilka</dt>
                <dd>
                  {order.barcode}
                  <small className="adm-sub">{packetStatusLabel(order)}</small>
                </dd>
              </div>
            )}
            <div>
              <dt>Platba</dt>
              <dd>{methodLabel(paymentMethods, order.paymentMethod)}</dd>
            </div>
            {order.paymentMethod === "transfer" && order.number && (
              <div>
                <dt>Variabilní symbol</dt>
                <dd>{order.number}</dd>
              </div>
            )}
          </dl>
        </Panel>
      </div>

      <Panel title="Položky" flush>
        {order.items.length === 0 ? (
          <p className="adm-empty">Objednávka nemá uložené položky.</p>
        ) : (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Vůně</th>
                  <th>Velikost</th>
                  <th>Počet</th>
                  <th className="adm-right">Cena</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={`${item.product_id}-${item.volume}-${index}`}>
                    <td>
                      <strong>{item.name}</strong>
                      <small className="adm-sub">{item.brand}</small>
                    </td>
                    <td>{item.volume}</td>
                    <td>{item.quantity} ks</td>
                    <td className="adm-right">{money(item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <dl className="adm-dl adm-order-sum">
          <div>
            <dt>Mezisoučet</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          {order.discountAmount > 0 && (
            <div className="adm-discount">
              <dt>Sleva {order.discountCode}</dt>
              <dd>−{money(order.discountAmount)}</dd>
            </div>
          )}
          <div>
            <dt>Doprava</dt>
            <dd>{order.shippingPrice ? money(order.shippingPrice) : "Zdarma"}</dd>
          </div>
          {order.paymentFee > 0 && (
            <div>
              <dt>Poplatek za platbu</dt>
              <dd>{money(order.paymentFee)}</dd>
            </div>
          )}
          <div className="adm-order-total">
            <dt>Celkem</dt>
            <dd>{money(order.total)}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
