import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Entete from '../components/Entete'
import Modale from '../components/Modale'
import {
  creerTransaction,
  formaterMontant,
  lireTransaction,
  listerTransactions,
  messageErreur,
  modifierTransaction,
  supprimerTransaction,
  versCentimes,
  type Transaction,
  type TransactionSaisie,
} from '../api'
import './Historique.css'
import './Carnet.css'

/*
 * Carnet budgétaire : le CRUD /api/transactions demandé par le livret.
 *   Liste     GET    /api/transactions
 *   Ajout     POST   /api/transactions
 *   Détail    GET    /api/transactions/:id
 *   Édition   PATCH  /api/transactions/:id   (champs modifiés uniquement)
 *   Suppr.    DELETE /api/transactions/:id   (après confirmation)
 * Ces lignes sont un pense-bête : elles ne modifient jamais le solde du
 * compte bancaire (les vrais mouvements sont dans l'Historique).
 */

type Filtre = 'tout' | 'income' | 'expense'

const FILTRES: { valeur: Filtre; label: string }[] = [
  { valeur: 'tout', label: 'Tout' },
  { valeur: 'income', label: 'Revenus' },
  { valeur: 'expense', label: 'Dépenses' },
]

// Une seule fenêtre ouverte à la fois
type Fenetre =
  | { type: 'formulaire'; edition: Transaction | null }
  | { type: 'detail'; id: string }
  | { type: 'suppression'; transaction: Transaction }
  | null

type Saisie = { label: string; montant: string; type: Transaction['type']; date: string }

// Date du jour au format YYYY-MM-DD (heure locale)
function aujourdHui() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formaterDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// 12345 centimes → « 123,45 » pour préremplir le champ montant
function versSaisieMontant(centimes: number) {
  return (centimes / 100).toFixed(2).replace('.', ',')
}

function saisieVide(): Saisie {
  return { label: '', montant: '', type: 'expense', date: aujourdHui() }
}

function saisieDepuis(t: Transaction): Saisie {
  return { label: t.label, montant: versSaisieMontant(t.amount), type: t.type, date: t.date }
}

// Mêmes règles que le back (label 1 à 120 caractères, montant entier > 0, date réelle)
function lireSaisie(s: Saisie): TransactionSaisie | string {
  const label = s.label.trim()
  if (!label) return 'Le libellé est obligatoire.'
  if (label.length > 120) return 'Le libellé ne doit pas dépasser 120 caractères.'
  const amount = versCentimes(s.montant)
  if (amount === null) return 'Le montant doit être positif, avec au maximum deux décimales (ex. 12,50).'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return 'La date est obligatoire.'
  return { label, amount, type: s.type, date: s.date }
}

// Corps du PATCH : seulement les champs qui ont changé
function champsModifies(avant: Transaction, apres: TransactionSaisie) {
  const corps: Partial<TransactionSaisie> = {}
  if (apres.label !== avant.label) corps.label = apres.label
  if (apres.amount !== avant.amount) corps.amount = apres.amount
  if (apres.type !== avant.type) corps.type = apres.type
  if (apres.date !== avant.date) corps.date = apres.date
  return corps
}

function Carnet() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreurListe, setErreurListe] = useState('')
  const [annonce, setAnnonce] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tout')

  const [fenetre, setFenetre] = useState<Fenetre>(null)
  const [saisie, setSaisie] = useState<Saisie>(saisieVide)
  const [detail, setDetail] = useState<Transaction | null>(null)
  const [erreurFenetre, setErreurFenetre] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const champLibelle = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listerTransactions()
      .then(setTransactions)
      .catch((err) => setErreurListe(messageErreur(err)))
      .finally(() => setChargement(false))
  }, [])

  // Détail : lu depuis l'API (GET /api/transactions/:id) à chaque ouverture
  useEffect(() => {
    if (fenetre?.type !== 'detail') return
    let annule = false
    lireTransaction(fenetre.id)
      .then((t) => !annule && setDetail(t))
      .catch((err) => !annule && setErreurFenetre(messageErreur(err)))
    return () => {
      annule = true
    }
  }, [fenetre])

  function fermer() {
    if (envoi) return
    setFenetre(null)
    setDetail(null)
    setErreurFenetre('')
  }

  function ouvrirAjout() {
    setSaisie(saisieVide())
    setErreurFenetre('')
    setFenetre({ type: 'formulaire', edition: null })
    setTimeout(() => champLibelle.current?.focus(), 50)
  }

  function ouvrirEdition(t: Transaction) {
    setSaisie(saisieDepuis(t))
    setErreurFenetre('')
    setFenetre({ type: 'formulaire', edition: t })
  }

  function ouvrirDetail(t: Transaction) {
    setDetail(null)
    setErreurFenetre('')
    setFenetre({ type: 'detail', id: t.id })
  }

  async function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (fenetre?.type !== 'formulaire') return

    const donnees = lireSaisie(saisie)
    if (typeof donnees === 'string') {
      setErreurFenetre(donnees)
      return
    }

    const edition = fenetre.edition
    if (edition && Object.keys(champsModifies(edition, donnees)).length === 0) {
      fermer()
      return
    }

    setEnvoi(true)
    setErreurFenetre('')
    try {
      if (edition) {
        const modifiee = await modifierTransaction(edition.id, champsModifies(edition, donnees))
        setTransactions((liste) => liste.map((t) => (t.id === modifiee.id ? modifiee : t)))
        setAnnonce(`« ${modifiee.label} » a été modifiée.`)
      } else {
        const creee = await creerTransaction(donnees)
        setTransactions((liste) => [creee, ...liste])
        setAnnonce(`« ${creee.label} » a été ajoutée au carnet.`)
      }
      setFenetre(null)
    } catch (err) {
      setErreurFenetre(messageErreur(err))
    } finally {
      setEnvoi(false)
    }
  }

  async function supprimer() {
    if (fenetre?.type !== 'suppression') return
    const { transaction } = fenetre

    setEnvoi(true)
    setErreurFenetre('')
    try {
      await supprimerTransaction(transaction.id)
      setTransactions((liste) => liste.filter((t) => t.id !== transaction.id))
      setAnnonce(`« ${transaction.label} » a été supprimée.`)
      setFenetre(null)
    } catch (err) {
      setErreurFenetre(messageErreur(err))
    } finally {
      setEnvoi(false)
    }
  }

  // Totaux en centimes exacts, convertis seulement à l'affichage
  const revenus = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const depenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const visibles = transactions
    .filter((t) => filtre === 'tout' || t.type === filtre)
    .sort((a, b) => b.date.localeCompare(a.date))

  const titreFenetre =
    fenetre?.type === 'formulaire'
      ? fenetre.edition
        ? 'Modifier la ligne'
        : 'Nouvelle ligne'
      : fenetre?.type === 'suppression'
        ? 'Supprimer cette ligne ?'
        : 'Détail de la ligne'

  return (
    <div className="page-app">
      <Entete />

      <main className="contenu historique carnet">
        <div className="historique-titre apparition">
          <h1>Carnet budgétaire</h1>
          <p>Notez vos revenus et dépenses. Ces lignes ne modifient pas votre solde.</p>
        </div>

        <section className="resume carnet-resume apparition">
          <div className="resume-carte">
            <p>Revenus</p>
            <p className="resume-montant entree">+ {formaterMontant(revenus)}</p>
          </div>
          <div className="resume-carte">
            <p>Dépenses</p>
            <p className="resume-montant">− {formaterMontant(depenses)}</p>
          </div>
          <div className="resume-carte">
            <p>Bilan</p>
            <p className={`resume-montant ${revenus >= depenses ? 'entree' : ''}`}>
              {revenus >= depenses ? '+ ' : '− '}
              {formaterMontant(Math.abs(revenus - depenses))}
            </p>
          </div>
        </section>

        <section className="outils apparition">
          <div className="filtres" role="group" aria-label="Filtrer les lignes">
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
          <button type="button" className="bouton carnet-ajouter" onClick={ouvrirAjout}>
            + Ajouter une ligne
          </button>
        </section>

        {/* Annonce des succès (lue par les lecteurs d'écran) */}
        <p className="carnet-annonce" role="status" aria-live="polite">
          {annonce}
        </p>

        <section className="liste apparition">
          {chargement ? (
            <p className="liste-vide" role="status">Chargement du carnet…</p>
          ) : erreurListe ? (
            <p className="liste-vide" role="alert">{erreurListe}</p>
          ) : visibles.length === 0 ? (
            <p className="liste-vide">
              {transactions.length === 0
                ? 'Votre carnet est vide. Ajoutez votre première ligne.'
                : 'Aucune ligne pour ce filtre.'}
            </p>
          ) : (
            <div className="jour">
              <ul>
                {visibles.map((t) => {
                  const entree = t.type === 'income'
                  return (
                    <li key={t.id} className="carnet-ligne">
                      <button type="button" className="operation" onClick={() => ouvrirDetail(t)}>
                        <span className={`operation-icone ${entree ? 'entree' : ''}`} aria-hidden="true">
                          {entree ? '↓' : '↑'}
                        </span>
                        <span className="operation-texte">
                          <span className="operation-libelle">{t.label}</span>
                          <span className="operation-categorie">
                            {entree ? 'Revenu' : 'Dépense'} ·{' '}
                            {new Date(`${t.date}T00:00:00`).toLocaleDateString('fr-FR')}
                          </span>
                        </span>
                        <span className={`operation-montant ${entree ? 'entree' : ''}`}>
                          {entree ? '+ ' : '− '}
                          {formaterMontant(t.amount)}
                        </span>
                      </button>
                      <div className="carnet-ligne-actions">
                        <button
                          type="button"
                          onClick={() => ouvrirEdition(t)}
                          aria-label={`Modifier « ${t.label} »`}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            setErreurFenetre('')
                            setFenetre({ type: 'suppression', transaction: t })
                          }}
                          aria-label={`Supprimer « ${t.label} »`}
                        >
                          Supprimer
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>

        <Link to="/accueil" className="lien-retour apparition">
          ← Retour à l'accueil
        </Link>
      </main>

      <Modale ouverte={fenetre !== null} onFermer={fermer} titre={titreFenetre}>
        {fenetre?.type === 'formulaire' && (
          <form className="carnet-formulaire" onSubmit={enregistrer} noValidate>
            <div className="carnet-type" role="radiogroup" aria-label="Type">
              {(['expense', 'income'] as const).map((type) => (
                <label key={type} className={saisie.type === type ? 'actif' : ''}>
                  <input
                    type="radio"
                    name="type"
                    value={type}
                    checked={saisie.type === type}
                    onChange={() => setSaisie({ ...saisie, type })}
                  />
                  {type === 'expense' ? 'Dépense' : 'Revenu'}
                </label>
              ))}
            </div>

            <label className="carnet-champ">
              <span>Libellé</span>
              <input
                ref={champLibelle}
                value={saisie.label}
                onChange={(e) => setSaisie({ ...saisie, label: e.target.value })}
                maxLength={120}
                placeholder="Ex. : Courses, salaire…"
                required
              />
            </label>

            <div className="carnet-champs-ligne">
              <label className="carnet-champ">
                <span>Montant (€)</span>
                <input
                  inputMode="decimal"
                  value={saisie.montant}
                  onChange={(e) => setSaisie({ ...saisie, montant: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </label>

              <label className="carnet-champ">
                <span>Date</span>
                <input
                  type="date"
                  value={saisie.date}
                  onChange={(e) => setSaisie({ ...saisie, date: e.target.value })}
                  required
                />
              </label>
            </div>

            {erreurFenetre && <p className="carnet-erreur" role="alert">{erreurFenetre}</p>}

            <div className="carnet-actions">
              <button type="button" className="bouton bouton-secondaire" onClick={fermer} disabled={envoi}>
                Annuler
              </button>
              <button type="submit" className="bouton" disabled={envoi}>
                {envoi ? 'Enregistrement…' : fenetre.edition ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </form>
        )}

        {fenetre?.type === 'detail' && (
          <>
            {!detail && !erreurFenetre && <p className="carnet-chargement" role="status">Chargement…</p>}
            {erreurFenetre && <p className="carnet-erreur" role="alert">{erreurFenetre}</p>}
            {detail && (
              <>
                <p className={`detail-montant ${detail.type === 'income' ? 'entree' : ''}`}>
                  {detail.type === 'income' ? '+ ' : '− '}
                  {formaterMontant(detail.amount)}
                </p>
                <dl className="detail">
                  <div>
                    <dt>Libellé</dt>
                    <dd>{detail.label}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{detail.type === 'income' ? 'Revenu' : 'Dépense'}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{formaterDate(detail.date)}</dd>
                  </div>
                </dl>
                <div className="carnet-actions">
                  <button
                    type="button"
                    className="bouton bouton-secondaire"
                    onClick={() => setFenetre({ type: 'suppression', transaction: detail })}
                  >
                    Supprimer
                  </button>
                  <button type="button" className="bouton" onClick={() => ouvrirEdition(detail)}>
                    Modifier
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {fenetre?.type === 'suppression' && (
          <>
            <p className="carnet-confirmation">
              « {fenetre.transaction.label} » ({formaterMontant(fenetre.transaction.amount)}) sera
              définitivement supprimée du carnet.
            </p>
            {erreurFenetre && <p className="carnet-erreur" role="alert">{erreurFenetre}</p>}
            <div className="carnet-actions">
              <button type="button" className="bouton bouton-secondaire" onClick={fermer} disabled={envoi}>
                Annuler
              </button>
              <button type="button" className="bouton bouton-danger" onClick={supprimer} disabled={envoi}>
                {envoi ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </>
        )}
      </Modale>
    </div>
  )
}

export default Carnet
