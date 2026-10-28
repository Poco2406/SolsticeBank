import { useState } from 'react'
// import { useEffect } from 'react' // ← à décommenter pour l'étape 3 (voir plus bas)
import { Link } from 'react-router-dom'
import Entete from '../components/Entete'
import { useCompteur } from '../hooks/useCompteur'
import './Accueil.css'

/*
 * ============================================================================
 *  BRANCHER CETTE PAGE SUR LE BACKEND
 * ============================================================================
 *
 *  Même principe que la page Historique (voir le commentaire en haut de
 *  Historique.tsx) : la page appelle l'API du backend, jamais la base de
 *  données directement.
 *
 *  Ce que l'équipe backend doit fournir
 *  ------------------------------------
 *  Une route qui renvoie le client connecté (identifié par sa session) :
 *
 *      GET /api/client
 *
 *  Réponse attendue (au format du type `Client` ci-dessous) :
 *
 *      { "civilite": "madame", "prenom": "Marie", "nom": "Durand",
 *        "solde": 1250.40 }
 *
 *  `civilite` vaut "monsieur", "madame" ou null si non renseignée.
 *
 *  Pour les dernières opérations, réutiliser la route de l'Historique
 *  (GET /api/operations) en ne gardant que les 3 ou 5 premières.
 *
 *  Étapes côté frontend
 *  --------------------
 *  1. Le proxy /api dans vite.config.ts (voir Historique.tsx, étape 1).
 *
 *  2. Dans le composant, remplacer
 *        const [client] = useState<Client | null>(null)
 *     par
 *        const [client, setClient] = useState<Client | null>(null)
 *
 *  3. Décommenter `import { useEffect }` en haut du fichier et ajouter :
 *
 *        useEffect(() => {
 *          fetch('/api/client', { credentials: 'include' })
 *            .then((reponse) => {
 *              // 401 = session expirée → retour à la page de connexion
 *              if (reponse.status === 401) return navigate('/')
 *              if (!reponse.ok) throw new Error(`Erreur ${reponse.status}`)
 *              return reponse.json().then((donnees: Client) => setClient(donnees))
 *            })
 *            .catch(() => {
 *              // afficher un message d'erreur à l'utilisateur
 *            })
 *        }, [navigate])
 *
 *     (avec `const navigate = useNavigate()` importé de react-router-dom)
 *
 *  Tant que `client` vaut null, la page affiche « Bonjour » et un solde
 *  « — € » : elle fonctionne déjà, et se remplit dès que le backend
 *  répond. Le solde défile tout seul jusqu'au bon montant.
 * ============================================================================
 */

type Civilite = 'monsieur' | 'madame' | null

// Format du client tel que la page l'attend
type Client = {
  civilite: Civilite
  prenom: string
  nom: string
  solde: number
}

// « Bonjour Monsieur Dupont », « Bonjour Madame Dupont »,
// « Bonjour Jean Dupont » si la civilité n'est pas renseignée,
// ou simplement « Bonjour » pendant le chargement
function salutation(client: Client | null) {
  if (!client) return 'Bonjour'
  const { civilite, prenom, nom } = client
  if (civilite === 'monsieur') return `Bonjour Monsieur ${nom}`
  if (civilite === 'madame') return `Bonjour Madame ${nom}`
  return `Bonjour ${prenom} ${nom}`
}

function Accueil() {
  // null tant que le backend n'est pas branché (voir étape 2 plus haut)
  const [client] = useState<Client | null>(null)
  const [soldeVisible, setSoldeVisible] = useState(true)
  const soldeAnime = useCompteur(client?.solde ?? 0)

  return (
    <div className="page-app">
      <Entete />

      <main className="contenu">
        <h1 className="titre-accueil apparition">
          {salutation(client)}
        </h1>

        <section className="carte-solde apparition">
          <p className="carte-solde-titre">Solde du compte</p>
          <p
            className={`carte-solde-montant ${soldeVisible ? '' : 'masque'}`}
            aria-hidden={!soldeVisible}
          >
            {client
              ? soldeAnime.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                })
              : '— €'}
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
          {/* TODO : afficher les dernières opérations (GET /api/operations, voir plus haut) */}
          <p className="vide">Aucune opération pour le moment.</p>
        </section>
      </main>
    </div>
  )
}

export default Accueil
