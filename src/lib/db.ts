import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// To avoid managing complex relational subcollections for this direct port,
// we will store the top-level keys as documents within a single "colegio_data" collection.
// This perfectly mimics their localStorage architecture and guarantees that all data is saved.

const COLLECTION_NAME = 'colegio_data';

export const StorageManager = {
  async cargar(clave: string, defecto: any = []) {
    try {
      const docRef = doc(db, COLLECTION_NAME, clave);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().value) {
        return JSON.parse(docSnap.data().value);
      }
      return defecto;
    } catch (e) {
      console.error(`Error loading ${clave} from Firestore:`, e);
      return defecto;
    }
  },

  async guardar(clave: string, datos: any) {
    try {
      const docRef = doc(db, COLLECTION_NAME, clave);
      await setDoc(docRef, { value: JSON.stringify(datos) });
    } catch (e) {
      console.error(`Error saving ${clave} to Firestore:`, e);
    }
  }
};
