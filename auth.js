// auth.js
import { db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
  const userSelect = document.getElementById('user-select');
  const loginButton = document.getElementById('login-button');
  const passwordInput = document.getElementById('password-input');
  const loginError = document.getElementById('login-error');

  let users = [];

  try {
    // Obtener lista de usuarios públicos
    const usersSnapshot = await getDocs(collection(db, 'users_public'));
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        username: userData.username,
        role: userData.role,
        empresa: userData.empresa,
        sucursal: userData.sucursal
      });
    });

    // Poblar el select con los usuarios
    users.forEach((user) => {
      const option = document.createElement('option');
      option.value = user.id; // Usamos el ID del documento
      option.textContent = user.username;
      userSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error al cargar los usuarios:', error);
    loginError.textContent = 'Error al cargar los usuarios.';
  }

  loginButton.addEventListener('click', async () => {
    const userId = userSelect.value;
    const password = passwordInput.value;

    if (!userId || !password) {
      loginError.textContent = 'Por favor, ingrese su contraseña.';
      return;
    }

    try {
      // Obtener datos del usuario seleccionado
      const userDoc = await getDoc(doc(db, 'users_private', userId));

      if (!userDoc.exists()) {
        loginError.textContent = 'Usuario no encontrado.';
        return;
      }

      const userPrivateData = userDoc.data();

      // Verificar la contraseña
      const hashedPassword = await hashPassword(password);
      if (hashedPassword !== userPrivateData.passwordHash) {
        loginError.textContent = 'Contraseña incorrecta.';
        return;
      }

      // Obtener datos públicos del usuario
      const userPublic = users.find(u => u.id === userId);

      // Guardar la sesión en localStorage
      localStorage.setItem('currentUser', JSON.stringify({
        uid: userId,
        username: userPublic.username,
        role: userPublic.role,
        empresa: userPublic.empresa,
        sucursal: userPublic.sucursal
      }));

      // Redirigir según el rol
      if (userPublic.role === 'admin') {
        window.location.href = 'adminPanel.html';
      } else if (userPublic.role === 'branch') {
        window.location.href = 'branchPanel.html';
      } else if (userPublic.role === 'auxiliar') {
        window.location.href = 'auxiliarPanel.html';
      } else {
        loginError.textContent = 'Rol de usuario no reconocido.';
      }
    } catch (error) {
      console.error('Error en la autenticación:', error);
      loginError.textContent = 'Error en la autenticación.';
    }
  });
});

// Función para hashear la contraseña
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
