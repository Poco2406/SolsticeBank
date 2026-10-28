import { useState } from 'react'
import { Link } from 'react-router-dom'
import Entete from '../components/Entete'
import { useCompteur } from '../hooks/useCompteur'
import './Accueil.css'

type Civilite = 'monsieur' | 'madame' | null

type Client = {
  civilite: Civilite
  prenom: string
  nom: string
  solde: number
}

// TODO : remplacer par les données du client récupérées depuis le backend
const client: Client = {
  civilite: 'monsieur',
  prenom: 'Jean',
  nom: 'Dupont',
  solde: 0,
}

// « Bonjour Monsieur Dupont », « Bonjour Madame Dupont »,
// ou « Bonjour Jean Dupont » si la civilité n'est pas renseignée
function salutation({ civilite, prenom, nom }: Client) {
  if (civilite === 'monsieur') return `Bonjour Monsieur ${nom}`
  if (civilite === 'madame') return `Bonjour Madame ${nom}`
  return `Bonjour ${prenom} ${nom}`
}

function Accueil() {
  const [soldeVisible, setSoldeVisible] = useState(true)
  const soldeAnime = useCompteur(client.solde)

  return (
    <div className="page-app">
      <Entete />

      <main className="contenu">
        <h1 className="titre-accueil apparition">
          {salutation(client)} <span className="salut"></span>
        </h1>

        <section className="carte-solde apparition">
          <p className="carte-solde-titre">Solde du compte</p>
          <p
            className={`carte-solde-montant ${soldeVisible ? '' : 'masque'}`}
            aria-hidden={!soldeVisible}
          >
            {soldeAnime.toLocaleString('fr-FR', {
              style: 'currency',
              currency: 'EUR',
            })}
          </p>
          <button
            type="button"
            className="bouton-masquer"
            onClick={() => setSoldeVisible((visible) => !visible)}
            aria-pressed={!soldeVisible}
          >
            {soldeVisible ? 'Masquer le solde' : 'Afficher le solde'}
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
          {/* TODO : afficher les dernières opérations depuis le backend */}
          <p className="vide">Aucune opération pour le moment.</p>
        </section>
      </main>
    </div>
  )
}

export default Accueil
