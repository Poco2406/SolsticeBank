
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import logoSolstice from '../assets/SolsticeBank.png'
import { demanderReinitialisation, messageErreur } from '../api'
import './MotDePasseOublie.css'

function MotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [messageEnvoye, setMessageEnvoye] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  // POST /api/auth/password/forgot : la réponse est la même que le compte
  // existe ou non (on ne révèle pas quels emails sont inscrits).
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErreur('')
    setEnvoi(true)
    try {
      await demanderReinitialisation(email)
      setMessageEnvoye(true)
    } catch (err) {
      // ex. trop de demandes (5 par quart d'heure), serveur injoignable
      setErreur(messageErreur(err))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main className="oubli-page">
      <div className="oubli-container">

        <div className="oubli-logo">
          <img
            src={logoSolstice}
            alt="Solstice Bank"
            className="oubli-logo-image"
          />
        </div>

        <p className="oubli-slogan">
          Votre banque, en toute simplicité.
        </p>

        <section className="oubli-card">
          <div className="oubli-icon" aria-hidden="true">
            🔒
          </div>

          <h1>Mot de passe oublié ?</h1>

          <p className="oubli-description">
            Saisissez votre adresse e-mail pour recevoir
            un lien de réinitialisation de votre mot de passe.
          </p>

          {!messageEnvoye ? (
            <form onSubmit={handleSubmit}>
              <div className="oubli-field">
                <label htmlFor="email">Adresse e-mail</label>
                <input
                  id="email"
                  type="email"
                  placeholder="exemple@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {erreur && (
                <p className="oubli-erreur" role="alert">
                  {erreur}
                </p>
              )}

              <button type="submit" className="oubli-submit" disabled={envoi}>
                {envoi ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>
          ) : (
            <div className="oubli-confirmation" role="status">
              <h2>Demande enregistrée</h2>
              <p>
                Si un compte est associé à cette adresse e-mail, vous recevrez un lien vous permettant de réinitialiser votre mot de passe.
                Le lien est valable 30 minutes ; pensez à vérifier vos courriers indésirables.
              </p>
              <button
                type="button"
                className="oubli-reessayer"
                onClick={() => setMessageEnvoye(false)}
              >
                Réessayer
              </button>
            </div>
          )}

          <Link to="/" className="oubli-retour">
            ← Retour à la connexion
          </Link>
        </section>

        <footer className="oubli-footer">
          © 2026 Solstice Bank
        </footer>

      </div>
    </main>
  )
}

export default MotDePasseOublie
