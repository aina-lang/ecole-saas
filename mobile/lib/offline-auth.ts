import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

// Déverrouillage hors ligne : à chaque connexion réussie EN LIGNE, on mémorise
// une empreinte salée du mot de passe (SHA-256 itéré, jamais le mot de passe)
// dans le stockage sécurisé du téléphone. Sans réseau, saisir le bon mot de
// passe redonne accès à l'app et aux données en cache — comme sur le poste
// desktop. Refus par défaut (fail-closed) si aucune empreinte n'existe.

const KEY = 'ecoleprof.pwverifier'
const ROUNDS = 5000

interface Verifier { email: string; salt: string; hash: string }

async function derive(password: string, salt: string): Promise<string> {
  let h = `${salt}:${password}`
  for (let i = 0; i < ROUNDS; i++) {
    h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, h)
  }
  return h
}

export async function saveVerifier(email: string, password: string): Promise<void> {
  const salt = Crypto.randomUUID()
  const hash = await derive(password, salt)
  const v: Verifier = { email: email.trim().toLowerCase(), salt, hash }
  await SecureStore.setItemAsync(KEY, JSON.stringify(v))
}

export async function verifyOffline(email: string, password: string): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    if (!raw) return false
    const v = JSON.parse(raw) as Verifier
    if (v.email !== email.trim().toLowerCase()) return false
    return (await derive(password, v.salt)) === v.hash
  } catch {
    return false
  }
}

export async function clearVerifier(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY)
}
