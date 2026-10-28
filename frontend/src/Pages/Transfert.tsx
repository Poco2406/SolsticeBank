import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Entete from '../components/Entete'
import Modale from '../components/Modale'
import './Transfert.css'

type Etape = 'saisie' | 'termine'

const MOTIF_MAX = 140

// « FR7630006000011234567890189 » → « FR76 3000 6000 0112 3456 7890 189 »
function formaterIban(valeur: string) {
  return valeur
    .replace(/\s/g, '')
    .toUpperCase()
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

function formaterMontant(montant: number) {
  return montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function Transfert() {
  const [etape, setEtape] = useState<Etape>('saisie')
  const [destinataire, setDestinataire] = useState('')
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')
  const [modaleOuverte, setModaleOuverte] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setModaleOuverte(true)
  }

  function confirmer() {
    // TODO : envoyer le transfert au backend, puis passer à 'termine' seulement si tout s'est bien passé
    setModaleOuverte(false)
    setEtape('termine')
  }

  function nouveauTransfert() {
    setDestinataire('')
    setMontant('')
    setMotif('')
    setEtape('saisie')
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
                  onChange={(e) => setMontant(e.target.value)}
                  required
                  autoFocus
                />
                <span>€</span>
              </div>
            </label>

            <label className="champ">
              <span>Destinataire (IBAN)</span>
              <input
                type="text"
                placeholder="FR76 0000 0000 0000 0000 0000 000"
                value={formaterIban(destinataire)}
                onChange={(e) => setDestinataire(e.target.value.replace(/\s/g, ''))}
                maxLength={42}
                required
              />
            </label>

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
            <svg className="coche" viewBox="0 0 52 52" aria-hidden="true">
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27 l7 7 l15 -15" />
            </svg>
            <h2>Transfert envoyé</h2>
            <p>
              {formaterMontant(Number(montant))} ont été envoyés à{' '}
              {formaterIban(destinataire)}.
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
          <Link to="/accueil" className="lien-retour apparition">
            ← Retour à l'accueil
          </Link>
        )}
      </main>

      <Modale
        ouverte={modaleOuverte}
        onFermer={() => setModaleOuverte(false)}
        titre="Confirmer le virement"
      >
        <div>
          <p className="recap-titre">Vous allez envoyer</p>
          <p className="recap-montant">{formaterMontant(Number(montant))}</p>
        </div>

        <dl className="recap">
          <div>
            <dt>À</dt>
            <dd>{formaterIban(destinataire)}</dd>
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

        <div className="actions-transfert">
          <button
            type="button"
            className="bouton bouton-secondaire"
            onClick={() => setModaleOuverte(false)}
          >
            Annuler
          </button>
          <button type="button" className="bouton" onClick={confirmer}>
            Confirmer le virement
          </button>
        </div>
      </Modale>
    </div>
  )
}

export default Transfert
