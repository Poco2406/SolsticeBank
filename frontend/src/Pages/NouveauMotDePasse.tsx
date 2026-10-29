import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import logoSolstice from '../assets/SolsticeBank.png'
import { deconnecter, messageErreur, reinitialiserMotDePasse } from '../api'
import './MotDePasseOublie.css'

/*
 * Page ouverte depuis le lien reçu par email : /reset-password?token=…
 * POST /api/auth/password/reset. Le jeton ne sert qu'une fois et expire au
 * bout de 30 minutes ; en cas de succès, toutes les sessions sont fermées.
 */

// Même format que le back : 64 caractères hexadécimaux
const FORMAT_JETON = /^[a-f0-9]{64}$/

function NouveauMotDePasse() {
  const [parametres] = useSearchParams()
  const token = parametres.get('token') ?? ''
  const lienValide = FORMAT_JETON.test(token)

  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [afficher, setAfficher] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const [termine, setTermine] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErreur('')

    if (motDePasse.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    // bcrypt ignore tout au-delà de 72 octets : le back refuse
    if (new TextEncoder().encode(motDePasse).length > 72) {
      setErreur('Le mot de passe est trop long (72 octets maximum).')
      return
    }
    if (motDePasse !== confirmation) {
      setErreur('Les mots de passe ne correspondent pas.')
      return
    }

    setEnvoi(true)
    try {
      await reinitialiserMotDePasse(token, motDePasse)
      // Les anciens jetons de session ne sont plus valables
      deconnecter()
      setTermine(true)
    } catch (err) {
      // ex. « Lien invalide, expiré ou déjà utilisé. »
      setErreur(messageErreur(err))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main className="oubli-page">
      <div className="oubli-container">
        <div className="oubli-logo">
          <img src={logoSolstice} alt="Solstice Bank" className="oubli-logo-image" />
        </div>

        <p className="oubli-slogan">Votre banque, en toute simplicité.</p>

        <section className="oubli-card">
          <div className="oubli-icon" aria-hidden="true">
            🔑
          </div>

          <h1>Nouveau mot de passe</h1>

          {!lienValide ? (
            <div className="oubli-confirmation" role="alert">
              <h2>Lien invalide</h2>
              <p>
                Ce lien de réinitialisation est incomplet ou mal copié. Demandez
                un nouveau lien pour réinitialiser votre mot de passe.
              </p>
              <Link to="/mot-de-passe-oublie" className="oubli-lien-bouton">
                Demander un nouveau lien
              </Link>
            </div>
          ) : termine ? (
            <div className="oubli-confirmation" role="status">
              <h2>Mot de passe modifié</h2>
              <p>
                Votre mot de passe a été réinitialisé. Pour votre sécurité, vous
                avez été déconnecté de tous vos appareils.
              </p>
              <Link to="/" className="oubli-lien-bouton">
                Se connecter
              </Link>
            </div>
          ) : (
            <>
              <p className="oubli-description">
                Choisissez un nouveau mot de passe d'au moins 8 caractères.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="oubli-field">
                  <label htmlFor="password">Nouveau mot de passe</label>
                  <input
                    id="password"
                    type={afficher ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="oubli-field">
                  <label htmlFor="confirmation">Confirmer le mot de passe</label>
                  <input
                    id="confirmation"
                    type={afficher ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    required
                  />
                </div>

                <label className="oubli-afficher">
                  <input
                    type="checkbox"
                    checked={afficher}
                    onChange={(e) => setAfficher(e.target.checked)}
                  />
                  Afficher les mots de passe
                </label>

                {erreur && (
                  <p className="oubli-erreur" role="alert">
                    {erreur}
                  </p>
                )}

                <button type="submit" className="oubli-submit" disabled={envoi}>
                  {envoi ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
                </button>
              </form>

              {erreur && (
                <Link to="/mot-de-passe-oublie" className="oubli-retour">
                  Demander un nouveau lien
                </Link>
              )}
            </>
          )}

          <Link to="/" className="oubli-retour">
            ← Retour à la connexion
          </Link>
        </section>

        <footer className="oubli-footer">© 2026 Solstice Bank</footer>
      </div>
    </main>
  )
}

export default NouveauMotDePasse
