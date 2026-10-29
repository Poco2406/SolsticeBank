/*
 * Client de l'API Solstice Bank : toutes les pages passent par ce fichier.
 *
 *  - Le jeton JWT reçu à la connexion / l'inscription est gardé dans le
 *    localStorage et envoyé à chaque appel (Authorization: Bearer <jeton>).
 *  - Une erreur de l'API ({"error":{"code","message"}}) devient une ApiError :
 *    `erreur.message` est lisible et peut être affiché tel quel.
 *  - Un 401 sur une route protégée (jeton expiré ou invalide) déconnecte
 *    l'utilisateur et renvoie à la page de connexion.
 *
 * Exemple dans une page :
 *
 *     try {
 *       const { items } = await listerMouvements({ limit: 5 })
 *     } catch (erreur) {
 *       setErreur(messageErreur(erreur))
 *     }
 *
 * Montants : toujours en centimes entiers positifs (12345 = 123,45 €),
 * c'est `type` qui donne le sens. Pour l'affichage : formaterMontant().
 * Détail de chaque route : Swagger sur http://localhost:3000/api/docs
 */

// ---------- Jeton de session ----------

const CLE_JETON = 'solstice.token'

export function lireJeton(): string | null {
  try {
    return localStorage.getItem(CLE_JETON)
  } catch {
    return null
  }
}

function enregistrerJeton(jeton: string) {
  try {
    localStorage.setItem(CLE_JETON, jeton)
  } catch {
    // stockage indisponible (navigation privée stricte) : la session ne survivra pas au rechargement
  }
}

export function deconnecter() {
  try {
    localStorage.removeItem(CLE_JETON)
  } catch {
    // rien à faire
  }
}

export function estConnecte(): boolean {
  return lireJeton() !== null
}

// ---------- Erreurs ----------

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// Message à afficher à l'utilisateur, quelle que soit l'erreur attrapée.
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof ApiError) return erreur.message
  return 'Impossible de joindre le serveur. Réessayez dans un instant.'
}

// ---------- Appel générique ----------

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  // false pour les routes publiques (connexion, inscription…)
  auth?: boolean
}

export async function api<T>(chemin: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, auth = true } = options
  const jeton = auth ? lireJeton() : null

  const reponse = await fetch(`/api${chemin}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(jeton && { Authorization: `Bearer ${jeton}` }),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 : aucun corps (ex. suppression)
  if (reponse.status === 204) return undefined as T

  const donnees = await reponse.json().catch(() => null)

  if (!reponse.ok) {
    // Session expirée ou jeton invalide : retour à la connexion
    if (reponse.status === 401 && auth) {
      deconnecter()
      if (window.location.pathname !== '/') window.location.assign('/')
    }
    const erreur = donnees?.error
    throw new ApiError(
      reponse.status,
      erreur?.code ?? 'INTERNAL_ERROR',
      erreur?.message ?? `Erreur ${reponse.status}`,
    )
  }

  return donnees as T
}

// ---------- Formatage ----------

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

// 12345 → « 123,45 € »
export function formaterMontant(centimes: number): string {
  return euros.format(centimes / 100)
}

// « 123,45 » ou « 123.45 » saisi dans un formulaire → 12345 (null si invalide)
export function versCentimes(saisie: string): number | null {
  const texte = saisie.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(texte)) return null
  const centimes = Math.round(Number(texte) * 100)
  return Number.isSafeInteger(centimes) && centimes > 0 ? centimes : null
}

// ---------- Types renvoyés par l'API ----------

export type Liste<T> = { items: T[] }
export type ListePaginee<T> = { items: T[]; page: number; limit: number; total: number }

export type Genre = 'female' | 'male' | 'other' | 'unspecified'

export type Adresse = {
  street: string
  complement?: string | null
  postalCode: string
  city: string
  country: string
}

export type ProfilSaisi = {
  firstName: string
  lastName: string
  username: string
  gender: Genre
  birthDate: string // YYYY-MM-DD
  phone: string // format international, ex. +33612345678
  address: Adresse
}

export type Profil = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  username: string | null
  gender: Genre
  birthDate: string | null
  address: Adresse | null
  phone: string | null
  status: 'active' | 'closed'
  emailVerified: boolean
  profileComplete: boolean
}

export type UtilisateurPublic = {
  id: string
  firstName: string | null
  lastName: string | null
  username: string | null
}

export type Compte = {
  id: string
  iban: string
  currency: 'EUR'
  balanceCents: number
  status: 'active' | 'closed'
}

// Dépôt/retrait : operationId renseigné ; virement : transferId renseigné
export type Mouvement = {
  id: string
  accountId: string
  operationId: string | null
  transferId: string | null
  type: 'deposit' | 'withdrawal' | 'transfer_debit' | 'transfer_credit'
  amountCents: number
  balanceAfterCents: number
  createdAt: string // date ISO
  // Autre partie d'un virement (null pour un dépôt ou un retrait)
  counterparty?: UtilisateurPublic | null
}

// Texte d'une ligne d'historique, commun à l'Historique et à l'Accueil.
// `entree` : l'argent arrive sur le compte (dépôt, virement reçu).
export function decrireMouvement(m: Mouvement): { libelle: string; categorie: string; entree: boolean } {
  const autre = m.counterparty
  const nom = autre
    ? [autre.firstName, autre.lastName].filter(Boolean).join(' ') || `@${autre.username}`
    : 'un client'
  switch (m.type) {
    case 'deposit':
      return { libelle: 'Dépôt', categorie: 'Dépôt', entree: true }
    case 'withdrawal':
      return { libelle: 'Retrait', categorie: 'Retrait', entree: false }
    case 'transfer_debit':
      return { libelle: `Virement à ${nom}`, categorie: 'Virement envoyé', entree: false }
    case 'transfer_credit':
      return { libelle: `Virement de ${nom}`, categorie: 'Virement reçu', entree: true }
  }
}

// Historique complet, page par page (100 par page, limite du back).
export async function listerTousMouvements(maxPages = 10): Promise<Mouvement[]> {
  const tous: Mouvement[] = []
  for (let page = 1; page <= maxPages; page++) {
    const { items, total } = await listerMouvements({ page, limit: 100 })
    tous.push(...items)
    if (tous.length >= total || items.length === 0) break
  }
  return tous
}

export type Transaction = {
  id: string
  label: string
  amount: number // centimes
  type: 'income' | 'expense'
  date: string // YYYY-MM-DD
}

export type TransactionSaisie = Omit<Transaction, 'id'>

type ReponseAuth = { user: { id: string; email: string }; token: string }

// ---------- Authentification ----------

export async function connecter(email: string, password: string) {
  const reponse = await api<ReponseAuth>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  })
  enregistrerJeton(reponse.token)
  return reponse.user
}

// `profile` est facultatif, mais s'il est fourni il doit être complet.
export async function inscrire(email: string, password: string, profile?: ProfilSaisi) {
  const reponse = await api<ReponseAuth>('/auth/register', {
    method: 'POST',
    body: { email, password, ...(profile && { profile }) },
    auth: false,
  })
  enregistrerJeton(reponse.token)
  return reponse.user
}

// Réponse toujours neutre, que l'email existe ou non.
export function demanderReinitialisation(email: string) {
  return api<{ message: string }>('/auth/password/forgot', {
    method: 'POST',
    body: { email },
    auth: false,
  })
}

// Jeton reçu par email (lien /reset-password?token=…). Succès : toutes les
// sessions ouvertes sont invalidées, il faut se reconnecter.
export function reinitialiserMotDePasse(token: string, password: string) {
  return api<{ message: string }>('/auth/password/reset', {
    method: 'POST',
    body: { token, password },
    auth: false,
  })
}

// ---------- Profil et annuaire ----------

export const lireProfil = () => api<Profil>('/me')

export const modifierProfil = (champs: Partial<ProfilSaisi>) =>
  api<Profil>('/me', { method: 'PATCH', body: champs })

export const listerUtilisateurs = (search?: string) =>
  api<ListePaginee<UtilisateurPublic>>(`/users${chaineRequete({ search })}`)

// ---------- Compte bancaire et historique ----------

export const lireCompte = () =>
  api<{ account: Compte }>('/account').then((r) => r.account)

export type FiltresMouvements = {
  type?: Mouvement['type']
  from?: string // YYYY-MM-DD, inclus
  to?: string // YYYY-MM-DD, inclus
  minAmountCents?: number
  maxAmountCents?: number
  page?: number
  limit?: number // 1 à 100, 20 par défaut
}

export const listerMouvements = (filtres: FiltresMouvements = {}) =>
  api<ListePaginee<Mouvement>>(`/movements${chaineRequete(filtres)}`)

export const lireMouvement = (id: string) => api<Mouvement>(`/movements/${id}`)

// ---------- Opérations d'argent ----------
// `cle` (Idempotency-Key) : générer avec crypto.randomUUID() et la réutiliser
// telle quelle si l'on renvoie la même demande après une erreur réseau.

export type ResultatOperation = {
  operation: {
    id: string
    accountId: string
    type: 'deposit' | 'withdrawal'
    amountCents: number
    balanceAfterCents: number
    createdAt: string
  }
  movement: Mouvement
  balanceCents: number // solde après l'opération
}

export type ResultatVirement = {
  transfer: {
    id: string
    senderAccountId: string
    recipientId: string
    amountCents: number
    createdAt: string
  }
  replayed: boolean // true : demande déjà traitée, aucun nouveau débit
}

export const deposer = (amountCents: number, cle: string) =>
  api<ResultatOperation>('/account/deposits', {
    method: 'POST',
    body: { amountCents },
    headers: { 'Idempotency-Key': cle },
  })

export const retirer = (amountCents: number, cle: string) =>
  api<ResultatOperation>('/account/withdrawals', {
    method: 'POST',
    body: { amountCents },
    headers: { 'Idempotency-Key': cle },
  })

// Destinataire : un utilisateur choisi dans l'annuaire, ou un IBAN saisi.
export type Destinataire = { id: string } | { iban: string }

export const virer = (destinataire: Destinataire, amountCents: number, cle: string) =>
  api<ResultatVirement>('/transfers', {
    method: 'POST',
    body:
      'id' in destinataire
        ? { recipientId: destinataire.id, amountCents }
        : { recipientIban: destinataire.iban, amountCents },
    headers: { 'Idempotency-Key': cle },
  })

// ---------- Carnet budgétaire (CRUD du livret, sans effet sur le solde) ----------

export const listerTransactions = () =>
  api<Liste<Transaction>>('/transactions').then((r) => r.items)

export const lireTransaction = (id: string) => api<Transaction>(`/transactions/${id}`)

export const creerTransaction = (saisie: TransactionSaisie) =>
  api<Transaction>('/transactions', { method: 'POST', body: saisie })

export const modifierTransaction = (id: string, champs: Partial<TransactionSaisie>) =>
  api<Transaction>(`/transactions/${id}`, { method: 'PATCH', body: champs })

export const supprimerTransaction = (id: string) =>
  api<void>(`/transactions/${id}`, { method: 'DELETE' })

// ---------- Utilitaire ----------

// { type: 'deposit', page: 2, search: undefined } → « ?type=deposit&page=2 »
function chaineRequete(parametres: Record<string, string | number | undefined>): string {
  const recherche = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (valeur !== undefined && valeur !== '') recherche.set(cle, String(valeur))
  }
  const texte = recherche.toString()
  return texte ? `?${texte}` : ''
}
