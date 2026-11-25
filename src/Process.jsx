import { useState } from "react";

import { navigate } from "./lib/navigate";

// "Jak připravujeme objednávku" (/jak-pripravujeme). Photos live in public/proces/
// under the file names below; until a photo is uploaded, a labelled placeholder
// shows which shot belongs there.
const steps = [
  {
    photo: "/proces/01-originaly.jpg",
    shot: "Originální flakony s krabičkami",
    title: "Jen originální balení",
    text: (
      <>
        Každý vzorek pochází z originálního flakonu výrobce. Žádné repliky ani
        „inspirované“ vůně. Originální krabičky schovávám, protože je na nich
        složení a šarže, a díky nim můžu u každého vzorku dohledat, z jakého
        flakonu je.
      </>
    ),
  },
  {
    photo: "/proces/02-plneni.jpg",
    shot: "Detail plnění vzorku z flakonu",
    title: "Plním až po vaší objednávce",
    text: (
      <>
        Vzorky nemám předplněné na skladě. Každý připravuji ručně až ve chvíli,
        kdy objednávku dostanu, přímo z originálního flakonu do čistého
        vzorkovacího flakonku. Vůně k vám tak přijde čerstvá.
      </>
    ),
  },
  {
    photo: "/proces/03-oznaceni.jpg",
    shot: "Označené flakonky se štítky",
    title: "Každý flakonek je označený",
    text: (
      <>
        Na štítku najdete název vůně, objem a šarži. Do balíčku přikládám list
        se složením každé vůně a upozorněními, abyste přesně věděli, co
        zkoušíte. Složení najdete i u každého produktu na webu.
      </>
    ),
  },
  {
    photo: "/proces/04-baleni.jpg",
    shot: "Černá krabička s černou výplní",
    title: "Zabalené jako dárek",
    text: (
      <>
        Vzorky ukládám do černé krabičky s černou výplní, aby cestu přečkaly v
        bezpečí a aby radost začala už rozbalováním. Krabička je hotová i jako
        dárek, stačí ji předat.
      </>
    ),
  },
  {
    photo: "/proces/05-odeslani.jpg",
    shot: "Balíček připravený k odeslání",
    title: "Rychle na cestě k vám",
    text: (
      <>
        Objednávky expeduji do 24 hodin přes Zásilkovnu, na výdejní místo,
        do Z-BOXu nebo až domů. Obvykle je máte do 1–2 pracovních dnů.
      </>
    ),
  },
];

function Photo({ src, shot }) {
  const [missing, setMissing] = useState(false);
  return missing ? (
    <div className="process-photo process-photo-empty" role="img" aria-label={shot}>
      <span>Fotka: {shot}</span>
    </div>
  ) : (
    <img className="process-photo" src={src} alt={shot} loading="lazy" onError={() => setMissing(true)} />
  );
}

export default function ProcessPage() {
  return (
    <div className="home-page">
      <main className="page-shell process-page">
        <header className="process-hero">
          <span className="eyebrow">Jak to děláme</span>
          <h1>Od originálního flakonu až k vám</h1>
          <p className="legal-lead">
            Každý vzorek připravuji ručně, až když si ho objednáte. Takhle
            vypadá cesta vaší objednávky.
          </p>
        </header>

        <ol className="process-steps">
          {steps.map((step, index) => (
            <li className="process-step" key={step.title}>
              <Photo src={step.photo} shot={step.shot} />
              <div className="process-text">
                <span className="process-number">{String(index + 1).padStart(2, "0")}</span>
                <h2>{step.title}</h2>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="process-cta">
          <h2>Vyberte si, co vyzkoušíte</h2>
          <button className="primary-button" onClick={() => navigate("/kolekce")}>
            Prohlédnout vzorky
          </button>
        </div>
      </main>
    </div>
  );
}
