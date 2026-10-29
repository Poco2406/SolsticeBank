import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Entete from "../components/Entete";
import { useCompteur } from "../hooks/useCompteur";
import {
  lireProfil,
  lireCompte,
  listerMouvements,
  decrireMouvement,
  formaterMontant,
  messageErreur,
  type Mouvement,
  type Profil,
  // type Genre,
} from "../api.ts";
import "./Accueil.css";

/*
 * Page d'accueil de l'utilisateur connecté.
 *  - Nom et civilité : GET /api/me (lireProfil)
 *  - Solde : GET /api/account (lireCompte, route de Jonathan)
 *  - Dernières opérations : GET /api/movements?limit=5 (listerMouvements)
 * Le jeton est ajouté automatiquement par api.ts ; une session expirée
 * renvoie vers la page de connexion.
 */

// « Bonjour Madame Martin », « Bonjour Monsieur Durand »,
// « Bonjour Alice Martin » sinon, ou « Bonjour » pendant le chargement.
function salutation(profil: Profil | null) {
  if (!profil?.lastName) return "Bonjour";
  // const civilites: Partial<Record<Genre, string>> = {
  //   female: "Madame",
  //   male: "Monsieur",
  // };
  // const titre = civilites[profil.gender];
  // return `Bonjour ${profil.firstName ?? ""} ${profil.lastName}`.trim();
  return `Bonjour ${profil.firstName}`.trim();
}

function Accueil() {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [soldeCentimes, setSoldeCentimes] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [soldeVisible, setSoldeVisible] = useState(true);
  const [iban, setIban] = useState<string | null>(null);
  const [ibanCopie, setIbanCopie] = useState(false);
  // null pendant le chargement ou si l'historique est indisponible
  const [dernieres, setDernieres] = useState<Mouvement[] | null>(null);

  // Copie l'IBAN (sans espaces) pour le transmettre à quelqu'un.
  async function copierIban() {
    if (!iban) return;
    try {
      await navigator.clipboard.writeText(iban);
      setIbanCopie(true);
      setTimeout(() => setIbanCopie(false), 2000);
    } catch {
      // presse-papiers indisponible : l'IBAN reste affiché et sélectionnable
    }
  }

  // Le compteur anime des euros : conversion depuis les centimes.
  const soldeAnime = useCompteur((soldeCentimes ?? 0) / 100);

  useEffect(() => {
    lireProfil()
      .then(setProfil)
      .catch((err) => setErreur(messageErreur(err)));

    lireCompte()
      .then((compte) => {
        setSoldeCentimes(compte.balanceCents);
        setIban(compte.iban);
      })
      .catch(() => {});

    // 403 si le profil est incomplet : on garde simplement la liste vide.
    listerMouvements({ limit: 5 })
      .then(({ items }) => setDernieres(items))
      .catch(() => setDernieres([]));
  }, []);

  return (
    <div className="page-app">
      <Entete />

      <main className="contenu">
        <h1 className="titre-accueil apparition">{salutation(profil)}</h1>

        {erreur && (
          <p className="erreur" role="alert">
            {erreur}
          </p>
        )}

        {/* Compte créé sans profil : les fonctions bancaires sont bloquées (403) */}
        {profil && !profil.profileComplete && (
          <p className="alerte-profil" role="status">
            Votre profil est incomplet : complétez-le pour accéder aux
            virements, dépôts, retraits et à l'historique.{" "}
            <Link to="/profil">Compléter mon profil</Link>
          </p>
        )}

        <section className="carte-solde apparition">
          <p className="carte-solde-titre">Solde du compte</p>
          <p
            className={`carte-solde-montant ${soldeVisible ? "" : "masque"}`}
            aria-hidden={!soldeVisible}
          >
            {soldeCentimes !== null
              ? soldeAnime.toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                })
              : "— €"}
          </p>
          <button
            type="button"
            className="bouton-masquer"
            onClick={() => setSoldeVisible((visible) => !visible)}
            aria-pressed={!soldeVisible}
          >
            {soldeVisible ? "Masquer le solde" : "Afficher le solde"}
          </button>

          {iban && (
            <div className="carte-solde-iban">
              <span>IBAN</span>
              <code>{iban.replace(/(.{4})/g, "$1 ").trim()}</code>
              <button type="button" onClick={copierIban}>
                {ibanCopie ? "Copié ✓" : "Copier"}
              </button>
              <span className="sr-only" role="status">
                {ibanCopie ? "IBAN copié dans le presse-papiers" : ""}
              </span>
            </div>
          )}
        </section>

        <section className="actions apparition">
          <Link to="/transfert" className="bouton">
            Faire un transfert
          </Link>
          <Link to="/historique" className="bouton bouton-secondaire">
            Voir l'historique
          </Link>
        </section>

        <section className="encadre apparition">
          <h2>Dernières opérations</h2>
          {dernieres === null ? (
            <p className="vide" role="status">Chargement…</p>
          ) : dernieres.length === 0 ? (
            <p className="vide">Aucune opération pour le moment.</p>
          ) : (
            <ul className="dernieres-operations">
              {dernieres.map((m) => {
                const { libelle, categorie, entree } = decrireMouvement(m);
                return (
                  <li key={m.id}>
                    <span className="dernieres-texte">
                      <span>{libelle}</span>
                      <small>
                        {categorie} ·{" "}
                        {new Date(m.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </small>
                    </span>
                    <span className={`dernieres-montant ${entree ? "entree" : ""}`}>
                      {entree ? "+ " : "− "}
                      {formaterMontant(m.amountCents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/historique" className="lien-historique">
            Tout l'historique →
          </Link>
        </section>
      </main>
    </div>
  );
}

export default Accueil;
