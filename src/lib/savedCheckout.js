import { paymentMethods, shippingMethods } from "./checkout";

// Checkout details offered again on the next purchase: for a logged-in customer
// from their latest order (read through the "own orders" policy), for a guest
// from this browser — and only when they ticked "Zapamatovat údaje".
// Everything is validated on the way in: storage can hold anything.

const STORAGE_KEY = "eparfumes-checkout";
const text = (value, max = 200) => (typeof value === "string" ? value.slice(0, max) : "");

const cleanPoint = (point) =>
  point && typeof point === "object" && text(point.name)
    ? {
        ...(text(point.id, 40) && { id: text(point.id, 40) }),
        name: text(point.name),
        ...(text(point.street) && { street: text(point.street) }),
        ...(text(point.city) && { city: text(point.city) }),
        ...(text(point.zip, 20) && { zip: text(point.zip, 20) }),
      }
    : null;

const cleanAddress = (address) =>
  address && typeof address === "object"
    ? { street: text(address.street), city: text(address.city), zip: text(address.zip, 20) }
    : null;

// Never the note or the discount code: those belong to a single order.
export const cleanDetails = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const shipping = shippingMethods.some((method) => method.key === raw.shipping) ? raw.shipping : null;
  // A method switched off since (e.g. bank transfer without an account number) is skipped.
  const payment = paymentMethods.some((method) => method.key === raw.payment && method.enabled !== false)
    ? raw.payment
    : null;
  return {
    name: text(raw.name),
    email: text(raw.email),
    phone: text(raw.phone, 40),
    shipping,
    payment,
    point: cleanPoint(raw.point),
    address: cleanAddress(raw.address),
  };
};

export const detailsFromOrder = (order) =>
  cleanDetails({
    name: order.customer_name,
    email: order.email,
    phone: order.phone,
    shipping: order.shipping_method,
    payment: order.payment_method,
    point: order.shipping_point,
    address: order.shipping_address,
  });

export const loadSavedDetails = () => {
  try {
    return cleanDetails(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return null;
  }
};

export const saveDetails = (details) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanDetails(details)));
  } catch {
    // Storage blocked: nothing is remembered, which is fine.
  }
};

export const forgetDetails = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: there is nothing to forget either.
  }
};
