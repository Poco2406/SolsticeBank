import { useState } from 'react'
// import { useEffect } from 'react' // ← à décommenter pour l'étape 3 (voir plus bas)
import { Link } from 'react-router-dom'
import Entete from '../components/Entete'
import Modale from '../components/Modale'
import './Historique.css'

/*
 * ============================================================================
 *  BRANCHER CETTE PAGE SUR LA BASE DE DONNÉES
 * ============================================================================
 *
 *  Le frontend ne parle JAMAIS directement à la base de données (ce serait
 *  une faille de sécurité : les identifiants de la base seraient visibles dans
 *  le navigateur). Le chemin est toujours :
 *
 *      Page React  ──fetch──▶  API du backend  ──requête SQL──▶  Base de données
 *                  ◀──JSON───                  ◀────lignes──────
 *
 *  Ce que l'équipe backend doit fournir
 *  ------------------------------------
 *  Une route qui renvoie les opérations du client connecté, par exemple :
 *
 *      GET /api/operations
 *
 *  Réponse attendue (un tableau JSON, au format du type `Operation` ci-dessous) :
 *
 *      [
 *        { "id": 1, "date": "2026-10-27T14:30:00", "libelle": "Carrefour",
 *          "categorie": "Courses", "montant": -54.32 },
 *        ...
 *      ]
 *
 *  Le backend identifie le client grâce à sa session (cookie ou jeton reçu à
 *  la connexion) : la page n'envoie donc PAS l'id du client dans l'URL,
 *  sinon n'importe qui pourrait lire les opérations d'un autre client.
 *
 *  Étapes côté frontend
 *  --------------------
 *  1. Dans vite.config.ts, rediriger /api vers le backend pendant le
 *     développement (évite les erreurs CORS) :
 *
 *        server: {
 *          proxy: { '/api': 'http://localhost:3000' }, // ← port du backend
 *        },
 *
 *  2. Dans le composant, remplacer
 *        const [operations] = useState<Operation[]>([])
 *     par
 *        const [operations, setOperations] = useState<Operation[]>([])
 *        const [chargement, setChargement] = useState(true)
 *        const [erreur, setErreur] = useState('')
 *
 *  3. Décommenter `import { useEffect }` en haut du fichier et ajouter dans
 *     le composant :
 *
 *        useEffect(() => {
 *          fetch('/api/operations', { credentials: 'include' })
 *            .then((reponse) => {
 *              if (!reponse.ok) throw new Error(`Erreur ${reponse.status}`)
 *              return reponse.json()
 *            })
 *            .then((donnees: Operation[]) => setOperations(donnees))
 *            .catch(() => setErreur('Impossible de charger vos opérations.'))
 *            .finally(() => setChargement(false))
 *        }, [])
 *
 *  4. Dans le JSX, juste avant la liste, afficher l'état du chargement :
 *
 *        {chargement && <p className="liste-vide">Chargement…</p>}
 *        {erreur && <p className="liste-vide">{erreur}</p>}
 *
 *  Tout le reste (totaux, filtres, recherche, regroupement par jour, détail)
 *  se met à jour tout seul à partir de `operations`.
 *
 *  Si le backend renvoie des noms de champs différents (ex. `amount` au lieu
 *  de `montant`), convertir dans le second `.then(...)` avec un `.map(...)`
 *  plutôt que de modifier le reste de la page.
 * ============================================================================
 */

// Format d'une opération tel que la page l'attend
type Operation = {
  id: number
  date: string // format ISO : '2026-10-27T14:30:00'
  libelle: string
  categorie: string
  montant: number // positif = entrée d'argent, négatif = sortie
}

type Filtre = 'tout' | 'entrees' | 'sorties'

const FILTRES: { valeur: Filtre; label: string }[] = [
  { valeur: 'tout', label: 'Tout' },
  { valeur: 'entrees', label: 'Entrées' },
  { valeur: 'sorties', label: 'Sorties' },
]

function formaterMontant(montant: number, signe = false) {
  const texte = Math.abs(montant).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  })
  if (!signe) return texte
  return montant >= 0 ? `+ ${texte}` : `− ${texte}`
}

function formaterJour(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formaterHeure(date: string) {
  return new Date(date).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Historique() {
  // Liste vide tant que le backend n'est pas branché (voir étape 2 plus haut)
  const [operations] = useState<Operation[]>([])
  const [filtre, setFiltre] = useState<Filtre>('tout')
  const [recherche, setRecherche] = useState('')
  const [selection, setSelection] = useState<Operation | null>(null)

  const totalEntrees = operations
    .filter((op) => op.montant > 0)
    .reduce((total, op) => total + op.montant, 0)
  const totalSorties = operations
    .filter((op) => op.montant < 0)
    .reduce((total, op) => total + op.montant, 0)

  // Opérations filtrées puis regroupées par jour (les plus récentes en premier)
  const texte = recherche.trim().toLowerCase()
  const filtrees = operations
    .filter((op) => {
      if (filtre === 'entrees') return op.montant > 0
      if (filtre === 'sorties') return op.montant < 0
      return true
    })
    .filter(
      (op) =>
        op.libelle.toLowerCase().includes(texte) ||
        op.categorie.toLowerCase().includes(texte),
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  const groupes = new Map<string, Operation[]>()
  for (const op of filtrees) {
    const jour = op.date.slice(0, 10)
    groupes.set(jour, [...(groupes.get(jour) ?? []), op])
  }
  const jours = [...groupes.entries()]

  return (
    <div className="page-app">
      <Entete />

      <main className="contenu historique">
        <div className="historique-titre apparition">
          <h1>Historique</h1>
          <p>Retrouvez toutes vos opérations.</p>
        </div>

        <section className="resume apparition">
          <div className="resume-carte">
            <p>Entrées</p>
            <p className="resume-montant entree">
              {formaterMontant(totalEntrees, true)}
            </p>
          </div>
          <div className="resume-carte">
            <p>Sorties</p>
            <p className="resume-montant">{formaterMontant(totalSorties, true)}</p>
          </div>
        </section>

        <section className="outils apparition">
          <div className="filtres" role="group" aria-label="Filtrer les opérations">
            {FILTRES.map(({ valeur, label }) => (
              <button
                key={valeur}
                type="button"
                className={filtre === valeur ? 'actif' : ''}
                aria-pressed={filtre === valeur}
                onClick={() => setFiltre(valeur)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="recherche"
            placeholder="Rechercher une opération"
            aria-label="Rechercher une opération"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </section>

        <section className="liste apparition">
          {jours.length === 0 ? (
            <p className="liste-vide">Aucune opération trouvée.</p>
          ) : (
            jours.map(([jour, ops]) => (
              <div key={jour} className="jour">
                <h2 className="jour-titre">{formaterJour(jour)}</h2>
                <ul>
                  {ops.map((op, i) => (
                    <li key={op.id} style={{ animationDelay: `${i * 50}ms` }}>
                      <button
                        type="button"
                        className="operation"
                        onClick={() => setSelection(op)}
                      >
                        <span
                          className={`operation-icone ${op.montant > 0 ? 'entree' : ''}`}
                          aria-hidden="true"
                        >
                          {op.montant > 0 ? '↓' : '↑'}
                        </span>
                        <span className="operation-texte">
                          <span className="operation-libelle">{op.libelle}</span>
                          <span className="operation-categorie">
                            {op.categorie} · {formaterHeure(op.date)}
                          </span>
                        </span>
                        <span
                          className={`operation-montant ${op.montant > 0 ? 'entree' : ''}`}
                        >
                          {formaterMontant(op.montant, true)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <Link to="/accueil" className="lien-retour apparition">
          ← Retour à l'accueil
        </Link>
      </main>

      <Modale
        ouverte={selection !== null}
        onFermer={() => setSelection(null)}
        titre="Détail de l'opération"
      >
        {selection && (
          <>
            <p
              className={`detail-montant ${selection.montant > 0 ? 'entree' : ''}`}
            >
              {formaterMontant(selection.montant, true)}
            </p>
            <dl className="detail">
              <div>
                <dt>Libellé</dt>
                <dd>{selection.libelle}</dd>
              </div>
              <div>
                <dt>Catégorie</dt>
                <dd>{selection.categorie}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>
                  {formaterJour(selection.date)} à {formaterHeure(selection.date)}
                </dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{selection.montant > 0 ? 'Entrée' : 'Sortie'}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="bouton"
              onClick={() => setSelection(null)}
            >
              Fermer
            </button>
          </>
        )}
      </Modale>
    </div>
  )
}

export default Historique
