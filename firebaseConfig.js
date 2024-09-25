// firebaseConfig.js

// Importa las funciones necesarias desde Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

// Tu configuración de Firebase (reemplaza con tus propios datos)
const firebaseConfig = {
  apiKey: "AIzaSyA36FovrfzpJOtQsQSkoauV4GGA6n5yD3M",
  authDomain: "dbticketsystem.firebaseapp.com",
  projectId: "dbticketsystem",
  storageBucket: "dbticketsystem.appspot.com",
  messagingSenderId: "1072328647719",
  appId: "1:1072328647719:web:4bbbb98df269ba51fa1a02"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa Firestore
const db = getFirestore(app);

// Inicializa Firebase Storage
const storage = getStorage(app);

// Exporta las instancias para usarlas en otros módulos
export { db, storage };