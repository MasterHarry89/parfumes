import { useState } from "react";
import { FiChevronRight, FiPlus, FiSearch } from "react-icons/fi";

import { genderLabel, money, tagList } from "../lib/catalog";
import { navigate } from "../lib/navigate";
import { Empty, Panel, Product } from "./views";

const openProduct = (id) => navigate(`/admin/produkty/${encodeURIComponent(id)}`);

// All products, including hidden ones. Click a row to edit it.
export default function ProductsView({ products, stock }) {
  const [query, setQuery] = useState("");
  const mlById = new Map(stock.map((item) => [item.productId, item.stockMl]));
  const needle = query.trim().toLowerCase();
  const visible = products.filter((product) =>
    `${product.name} ${product.brand}`.toLowerCase().includes(needle),
  );

  return (
    <div className="adm-page">
      <div className="adm-toolbar">
        <label className="adm-search">
          <FiSearch aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hledat podle názvu nebo značky"
            aria-label="Hledat produkt"
          />
        </label>
        <button className="adm-button" onClick={() => navigate("/admin/produkty/novy")}>
          <FiPlus aria-hidden="true" /> Nový produkt
        </button>
      </div>

      <Panel flush>
        {visible.length === 0 ? (
          <Empty>{products.length === 0 ? "Zatím tu nejsou žádné produkty." : "Nic jsme nenašli."}</Empty>
        ) : (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>Pro koho</th>
                  <th>Štítky</th>
                  <th>Cena od</th>
                  <th>Na skladě</th>
                  <th>Stav</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => {
                  const ml = mlById.get(product.id);
                  const tags = tagList(product.tag);
                  return (
                    <tr
                      key={product.id}
                      className="is-link"
                      onClick={() => openProduct(product.id)}
                    >
                      <td>
                        <Product
                          item={{
                            productId: product.id,
                            name: product.name,
                            brand: product.brand,
                            image: product.image,
                          }}
                        />
                      </td>
                      <td>{genderLabel[product.gender] ?? <span className="adm-muted-text">nevyplněno</span>}</td>
                      <td>
                        {tags.length === 0 ? (
                          "—"
                        ) : (
                          <div className="adm-chips">
                            {tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{money(Number(product.price || 0))}</td>
                      <td>{ml === undefined ? "—" : `${ml} ml`}</td>
                      <td>
                        <span className={`adm-pill ${product.active === false ? "" : "adm-pill-ok"}`}>
                          {product.active === false ? "Skrytý" : "V e-shopu"}
                        </span>
                      </td>
                      <td className="adm-right adm-row-arrow">
                        <FiChevronRight aria-hidden="true" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
