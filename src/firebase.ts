import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  type User
} from 'firebase/auth'
import {
  getFirestore
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import firebaseConfig from '../firebase-applet-config.json'

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()

export { firebaseConfig, onAuthStateChanged, signInWithGoogle }
export type { User }

function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export enum OperationType {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  WRITE = 'write'
}

function isPermissionError(message: string) {
  return (
    message.includes('permission-denied') ||
    message.includes('Missing or insufficient permissions') ||
    message.includes('insufficient permissions')
  )
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const rawMessage = error instanceof Error ? error.message : String(error)

  const message = isPermissionError(rawMessage)
    ? 'Acesso negado. Você não tem permissão para esta ação.'
    : 'Ocorreu um erro ao processar a solicitação. Tente novamente.'

  console.error(`Firestore Error [${operationType}] on [${path ?? 'unknown'}]:`, rawMessage)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('firestore-error', {
        detail: {
          message,
          type: 'error',
          operationType,
          path,
          rawMessage
        }
      })
    )
  }

  return {
    message,
    operationType,
    path,
    rawMessage
  }
}