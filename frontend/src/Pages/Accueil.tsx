import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompteur } from '../hooks/useCompteur'
import './Accueil.css'

// TODO : remplacer par les données du client récupérées depuis le backend
const client = {
  prenom: 'Client',
  solde: 0,
}

function Accueil() {
  const [soldeVisible, setSoldeVisible] = useState(true)
  const soldeAnime = useCompteur(client.solde)

  return (
    <div className="accueil">
      <header className="entete">
        <span className="logo">SolsticeBank</span>
        <Link to="/" className="bouton bouton-secondaire">
          Se déconnecter
        </Link>
      </header>

      <main className="accueil-contenu">
        <h1 className="apparition">
          Bonjour {client.prenom} <span className="salut"></span>
        </h1>

        <section className="carte-solde apparition">
          <div className="carte-solde-haut">
            <p className="carte-solde-titre">Solde du compte</p>
            <button
              type="button"
              className="bouton-masquer"
              onClick={() => setSoldeVisible((visible) => !visible)}
              aria-pressed={!soldeVisible}
            >
              {soldeVisible ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          <p
            className={`carte-solde-montant ${soldeVisible ? '' : 'masque'}`}
            aria-hidden={!soldeVisible}
          >
            {soldeAnime.toLocaleString('fr-FR', {
              style: 'currency',
              currency: 'EUR',
            })}
          </p>
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
          {/* TODO : afficher les dernières opérations depuis le backend */}
          <p className="vide">Aucune opération pour le moment.</p>
        </section>
      </main>
    </div>
  )
}

export default Accueil
