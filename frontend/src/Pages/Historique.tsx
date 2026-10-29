import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Entete from '../components/Entete'
import Modale from '../components/Modale'
import {
  decrireMouvement,
  listerTousMouvements,
  messageErreur,
  type Mouvement,
} from '../api'
import './Historique.css'

/*
 * Historique du compte : dépôts, retraits et virements (GET /api/movements).
 * Les mouvements de l'API sont convertis au format `Operation` de la page :
 * totaux, filtres, recherche et regroupement par jour restent inchangés.
 */

// Format d'une opération tel que la page l'attend
type Operation = {
  id: string
  date: string // heure locale : '2026-10-27T14:30:00'
  libelle: string
  categorie: string
  montant: number // en euros : positif = entrée d'argent, négatif = sortie
  soldeApres: number // en euros
}

// Date ISO UTC de l'API → heure locale sans fuseau, pour que le
// regroupement par jour suive le jour vu par l'utilisateur (pas l'UTC).
function dateLocale(iso: string) {
  const d = new Date(iso)
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}T${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`
}

function versOperation(m: Mouvement): Operation {
  const { libelle, categorie, entree } = decrireMouvement(m)
  return {
    id: m.id,
    date: dateLocale(m.createdAt),
    libelle,
    categorie,
    montant: ((entree ? 1 : -1) * m.amountCents) / 100,
    soldeApres: m.balanceAfterCents / 100,
  }
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
  const [operations, setOperations] = useState<Operation[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tout')
  const [recherche, setRecherche] = useState('')
  const [selection, setSelection] = useState<Operation | null>(null)

  useEffect(() => {
    listerTousMouvements()
      .then((mouvements) => setOperations(mouvements.map(versOperation)))
      .catch((err) => setErreur(messageErreur(err)))
      .finally(() => setChargement(false))
  }, [])

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
          {chargement ? (
            <p className="liste-vide" role="status">Chargement de vos opérations…</p>
          ) : erreur ? (
            <p className="liste-vide" role="alert">{erreur}</p>
          ) : jours.length === 0 ? (
            <p className="liste-vide">
              {operations.length === 0
                ? 'Aucune opération pour le moment.'
                : 'Aucune opération trouvée.'}
            </p>
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
              <div>
                <dt>Solde après</dt>
                <dd>{formaterMontant(selection.soldeApres)}</dd>
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
