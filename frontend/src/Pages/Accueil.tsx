import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Entete from "../components/Entete";
import { useCompteur } from "../hooks/useCompteur";
import {
  lireProfil,
  lireCompte,
  messageErreur,
  type Profil,
  // type Genre,
} from "../api.ts";
import "./Accueil.css";

/*
 * Page d'accueil de l'utilisateur connecté.
 *  - Nom et civilité : GET /api/me (lireProfil)
 *  - Solde : GET /api/account (lireCompte, route de Jonathan)
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

  // Le compteur anime des euros : conversion depuis les centimes.
  const soldeAnime = useCompteur((soldeCentimes ?? 0) / 100);

  useEffect(() => {
    lireProfil()
      .then(setProfil)
      .catch((err) => setErreur(messageErreur(err)));

    // Tant que la route de Jonathan n'existe pas, le solde reste « — € ».
    lireCompte()
      .then((compte) => setSoldeCentimes(compte.balanceCents))
      .catch(() => {});
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
          {/* TODO : listerMouvements({ limit: 5 }) quand la route de Jonathan existera */}
          <p className="vide">Aucune opération pour le moment.</p>
        </section>
      </main>
    </div>
  );
}

export default Accueil;
