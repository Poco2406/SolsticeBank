
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Entete from '../components/Entete'
import Modale from '../components/Modale'
import { ApiError, listerUtilisateurs, messageErreur, virer } from '../api'
import type { UtilisateurPublic } from '../api'
import './Transfert.css'

type Etape = 'saisie' | 'termine'

// Bénéficiaire choisi dans l'annuaire, ou IBAN saisi à la main
type Mode = 'annuaire' | 'iban'

function nomComplet(u: UtilisateurPublic) {
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
}

// Recherche sans tenir compte des accents ni de la casse
function normaliser(texte: string) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const MOTIF_MAX = 140

function formaterIban(valeur: string) {
  return valeur
    .replace(/\s/g, '')
    .toUpperCase()
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

function formaterMontant(montant: number) {
  return montant.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  })
}

function Transfert() {
  const [etape, setEtape] = useState<Etape>('saisie')
  const [destinataire, setDestinataire] = useState('')
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')
  const [modaleOuverte, setModaleOuverte] = useState(false)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  const [mode, setMode] = useState<Mode>('annuaire')
  const [annuaire, setAnnuaire] = useState<UtilisateurPublic[]>([])
  const [erreurAnnuaire, setErreurAnnuaire] = useState('')
  const [recherche, setRecherche] = useState('')
  const [beneficiaire, setBeneficiaire] = useState<UtilisateurPublic | null>(null)

  // Conserver la clé en cas de nouvelle tentative.
  const cleVirement = useRef<string | null>(null)
  const envoiVerrouille = useRef(false)

  // L'annuaire (100 personnes maximum) est chargé une fois puis filtré ici.
  useEffect(() => {
    listerUtilisateurs()
      .then((page) => setAnnuaire(page.items))
      .catch((err) => setErreurAnnuaire(messageErreur(err)))
  }, [])

  const termes = normaliser(recherche.trim())
  const resultats = termes
    ? annuaire.filter((u) =>
        normaliser(`${u.username ?? ''} ${nomComplet(u)}`).includes(termes),
      )
    : annuaire

  // Libellé du destinataire pour le récapitulatif et la confirmation
  const libelleDestinataire =
    mode === 'annuaire'
      ? beneficiaire
        ? `${nomComplet(beneficiaire)} (@${beneficiaire.username})`
        : ''
      : formaterIban(destinataire)

  function reinitialiserDemande() {
    cleVirement.current = null
    setErreur('')
  }

  function changerMode(nouveau: Mode) {
    setMode(nouveau)
    reinitialiserDemande()
  }

  function choisirBeneficiaire(u: UtilisateurPublic) {
    setBeneficiaire(u)
    reinitialiserDemande()
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (envoiVerrouille.current) return

    if (mode === 'annuaire' && !beneficiaire) {
      setErreur('Choisissez un bénéficiaire dans la liste.')
      return
    }

    setErreur('')
    setModaleOuverte(true)
  }

  async function confirmer() {
    if (envoiVerrouille.current) return

    setErreur('')

    const montantEuros = Number(montant)
    const montantExact = montantEuros * 100
    const amountCents = Math.round(montantExact)
    const recipientIban = destinataire.replace(/\s/g, '').toUpperCase()

    if (
      !Number.isFinite(montantEuros) ||
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      Math.abs(montantExact - amountCents) > 0.000001
    ) {
      setErreur(
        'Le montant doit être valide et comporter au maximum deux décimales.',
      )
      return
    }

    if (mode === 'iban' && !/^FR\d{25}$/.test(recipientIban)) {
      setErreur('Veuillez saisir un IBAN français valide.')
      return
    }

    if (mode === 'annuaire' && !beneficiaire) {
      setErreur('Choisissez un bénéficiaire dans la liste.')
      return
    }

    envoiVerrouille.current = true
    setEnvoiEnCours(true)

    const key = cleVirement.current ?? crypto.randomUUID()
    cleVirement.current = key

    try {
      // Jeton, proxy et format d'erreur gérés par api.ts (401 → retour à la connexion)
      await virer(
        mode === 'annuaire' && beneficiaire
          ? { id: beneficiaire.id }
          : { iban: recipientIban },
        amountCents,
        key,
      )

      // Afficher la réussite uniquement après confirmation de l'API.
      setModaleOuverte(false)
      setEtape('termine')
      cleVirement.current = null
    } catch (err) {
      if (err instanceof ApiError) {
        // Refus explicite du serveur (solde insuffisant, destinataire inconnu…)
        setErreur(err.message)
      } else {
        // Ne pas changer la clé : le serveur peut avoir reçu le virement.
        setErreur(
          'Impossible de confirmer le résultat. Réessayez avec la même demande.',
        )
      }
    } finally {
      envoiVerrouille.current = false
      setEnvoiEnCours(false)
    }
  }

  function nouveauTransfert() {
    setDestinataire('')
    setBeneficiaire(null)
    setRecherche('')
    setMontant('')
    setMotif('')
    setEtape('saisie')
    reinitialiserDemande()
  }

  return (
    <div className="page-app">
      <Entete />

      <main className="contenu">
        <div className="transfert-titre apparition">
          <h1>Transfert d'argent</h1>
          <p>Envoyez de l'argent en quelques secondes.</p>
        </div>

        {etape === 'saisie' && (
          <form
            onSubmit={handleSubmit}
            className="carte-transfert apparition"
          >
            <label className="champ-montant">
              <span>Montant</span>
              <div className="champ-montant-saisie">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  value={montant}
                  onChange={(e) => {
                    setMontant(e.target.value)
                    reinitialiserDemande()
                  }}
                  required
                  autoFocus
                />
                <span>€</span>
              </div>
            </label>

            <fieldset className="choix-destinataire">
              <legend>Destinataire</legend>

              <div className="onglets-destinataire" role="group" aria-label="Type de destinataire">
                <button
                  type="button"
                  aria-pressed={mode === 'annuaire'}
                  onClick={() => changerMode('annuaire')}
                >
                  Un client Solstice
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'iban'}
                  onClick={() => changerMode('iban')}
                >
                  Par IBAN
                </button>
              </div>

              {mode === 'annuaire' && (
                beneficiaire ? (
                  <div className="beneficiaire-choisi">
                    <div>
                      <strong>{nomComplet(beneficiaire)}</strong>
                      <span>@{beneficiaire.username}</span>
                    </div>
                    <button
                      type="button"
                      className="lien-changer"
                      onClick={() => {
                        setBeneficiaire(null)
                        reinitialiserDemande()
                      }}
                    >
                      Changer
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="champ">
                      <span>Rechercher par nom ou pseudo</span>
                      <input
                        type="search"
                        placeholder="Ex. : Alice, @alice.martin"
                        value={recherche}
                        onChange={(e) => setRecherche(e.target.value)}
                        aria-controls="liste-beneficiaires"
                      />
                    </label>

                    {erreurAnnuaire ? (
                      <p className="liste-beneficiaires-vide" role="alert">
                        {erreurAnnuaire}
                      </p>
                    ) : resultats.length === 0 ? (
                      <p className="liste-beneficiaires-vide">
                        {annuaire.length === 0
                          ? 'Aucun autre client pour le moment.'
                          : 'Aucun client ne correspond à cette recherche.'}
                      </p>
                    ) : (
                      <ul id="liste-beneficiaires" className="liste-beneficiaires">
                        {resultats.map((u) => (
                          <li key={u.id}>
                            <button type="button" onClick={() => choisirBeneficiaire(u)}>
                              <strong>{nomComplet(u)}</strong>
                              <span>@{u.username}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )
              )}

              {mode === 'iban' && (
                <label className="champ">
                  <span>IBAN du destinataire</span>
                  <input
                    type="text"
                    placeholder="FR76 0000 0000 0000 0000 0000 000"
                    value={formaterIban(destinataire)}
                    onChange={(e) => {
                      setDestinataire(e.target.value.replace(/\s/g, ''))
                      reinitialiserDemande()
                    }}
                    maxLength={42}
                    required
                  />
                </label>
              )}
            </fieldset>

            {erreur && !modaleOuverte && (
              <p role="alert" style={{ color: '#dc2626' }}>
                {erreur}
              </p>
            )}

            <label className="champ">
              <span>
                Motif <em>(facultatif)</em>
              </span>
              <input
                type="text"
                placeholder="Ex. : Remboursement du restaurant"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                maxLength={MOTIF_MAX}
              />
              <small className="compteur-caracteres">
                {motif.length} / {MOTIF_MAX}
              </small>
            </label>

            <button type="submit" className="bouton">
              Continuer
            </button>
          </form>
        )}

        {etape === 'termine' && (
          <section className="carte-transfert succes apparition">
            <svg
              className="coche"
              viewBox="0 0 52 52"
              aria-hidden="true"
            >
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27 l7 7 l15 -15" />
            </svg>

            <h2>Transfert envoyé</h2>
            <p>
              {formaterMontant(Number(montant))} ont été envoyés à{' '}
              {libelleDestinataire}.
            </p>

            <div className="actions-transfert">
              <button
                type="button"
                className="bouton bouton-secondaire"
                onClick={nouveauTransfert}
              >
                Nouveau transfert
              </button>

              <Link to="/accueil" className="bouton">
                Retour à l'accueil
              </Link>
            </div>
          </section>
        )}

        {etape !== 'termine' && (
          <Link
            to="/accueil"
            className="lien-retour apparition"
          >
            ← Retour à l'accueil
          </Link>
        )}
      </main>

      <Modale
        ouverte={modaleOuverte}
        onFermer={() => {
          if (!envoiVerrouille.current) {
            setModaleOuverte(false)
          }
        }}
        titre="Confirmer le virement"
      >
        <div>
          <p className="recap-titre">Vous allez envoyer</p>
          <p className="recap-montant">
            {formaterMontant(Number(montant))}
          </p>
        </div>

        <dl className="recap">
          <div>
            <dt>À</dt>
            <dd>{libelleDestinataire}</dd>
          </div>

          {motif && (
            <div>
              <dt>Motif</dt>
              <dd>{motif}</dd>
            </div>
          )}
        </dl>

        <p className="avertissement">
          Un virement confirmé ne peut pas être annulé.
        </p>

        {erreur && (
          <p role="alert" style={{ color: '#dc2626' }}>
            {erreur}
          </p>
        )}

        <div className="actions-transfert">
          <button
            type="button"
            className="bouton bouton-secondaire"
            onClick={() => setModaleOuverte(false)}
            disabled={envoiEnCours}
          >
            Annuler
          </button>

          <button
            type="button"
            className="bouton"
            onClick={confirmer}
            disabled={envoiEnCours}
          >
            {envoiEnCours
              ? 'Virement en cours...'
              : 'Confirmer le virement'}
          </button>
        </div>
      </Modale>
    </div>
  )
}

export default Transfert
