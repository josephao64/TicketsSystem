// adminPanel.js
import { db } from './firebaseConfig.js';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
  const logoutButton = document.getElementById('logout-button');
  const createUserForm = document.getElementById('create-user-form');
  const usersList = document.getElementById('users-list');
  const createTicketForm = document.getElementById('create-ticket-form');
  const ticketsList = document.getElementById('tickets-list');
  const filterButtons = document.querySelectorAll('.filter-button');

  let currentUser = JSON.parse(localStorage.getItem('currentUser'));

  // Verificar si el usuario está autenticado y es administrador
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Acceso no autorizado');
    window.location.href = 'index.html';
  } else {
    loadUsers();
    loadTickets(); // Cargar todos los tickets inicialmente
  }

  // Cerrar sesión
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  });

  // Crear nuevo usuario
  createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    const empresa = document.getElementById('new-empresa').value.trim();
    const sucursal = document.getElementById('new-sucursal').value.trim();

    if (!username || !password || !empresa || !sucursal) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    try {
      // Hashear la contraseña
      const passwordHash = await hashPassword(password);

      // Generar un ID único para el usuario
      const userRef = doc(collection(db, 'users_public'));
      const userId = userRef.id;

      // Guardar información pública en users_public
      await setDoc(userRef, {
        username,
        role,
        empresa,
        sucursal
      });

      // Guardar información privada en users_private
      await setDoc(doc(db, 'users_private', userId), {
        passwordHash
      });

      alert('Usuario creado exitosamente');
      createUserForm.reset();
      // Actualizar la lista de usuarios
      loadUsers();
    } catch (error) {
      console.error('Error al crear usuario:', error);
      alert('Error al crear usuario: ' + error.message);
    }
  });

  // Crear nuevo ticket
  createTicketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('ticket-title').value.trim();
    const description = document.getElementById('ticket-description').value.trim();
    const priority = document.getElementById('ticket-priority').value;

    if (!title || !description) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    try {
      // Obtener el siguiente ID numérico para el ticket
      const nextId = await getNextTicketId();

      // Obtener fecha y hora actuales
      const createdAt = Timestamp.now();

      // Crear ticket en Firestore
      await setDoc(doc(db, 'tickets', nextId.toString()), {
        id: nextId,
        title,
        description,
        priority,
        status: 'abierto',
        createdAt,
        emittedBy: currentUser.username,
        empresa: currentUser.empresa || 'Empresa Default',
        sucursal: currentUser.sucursal || 'Sucursal Default',
        assignedTo: null
      });

      alert('Ticket creado exitosamente con ID: ' + nextId);
      createTicketForm.reset();
      // Actualizar la lista de tickets
      loadTickets();
    } catch (error) {
      console.error('Error al crear ticket:', error);
      alert('Error al crear ticket: ' + error.message);
    }
  });

  // Función para obtener el siguiente ID de ticket
  async function getNextTicketId() {
    const ticketsRef = collection(db, 'tickets');
    const q = query(ticketsRef, orderBy('id', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return 1;
    } else {
      const lastTicket = querySnapshot.docs[0].data();
      return lastTicket.id + 1;
    }
  }

  // Cargar la lista de usuarios
  async function loadUsers() {
    usersList.innerHTML = '<h3>Usuarios Registrados</h3>';
    const usersSnapshot = await getDocs(collection(db, 'users_public'));
    usersSnapshot.forEach((doc) => {
      const user = doc.data();
      const userDiv = document.createElement('div');
      userDiv.innerHTML = `
        <p>Usuario: ${user.username}, Rol: ${user.role}, Empresa: ${user.empresa}, Sucursal: ${user.sucursal}</p>
        <button class="edit-user-button" data-id="${doc.id}">Editar</button>
        <button class="delete-user-button" data-id="${doc.id}">Eliminar</button>
      `;
      usersList.appendChild(userDiv);

      // Añadir eventos a los botones
      userDiv.querySelector('.edit-user-button').addEventListener('click', () => {
        editUser(doc.id, user);
      });
      userDiv.querySelector('.delete-user-button').addEventListener('click', () => {
        deleteUser(doc.id);
      });
    });
  }

  // Editar usuario
  function editUser(userId, userData) {
    // Mostrar un prompt para editar los datos
    const newUsername = prompt('Editar Nombre de Usuario:', userData.username);
    if (newUsername === null) return; // Cancelado

    const newRole = prompt('Editar Rol (admin/branch/auxiliar):', userData.role);
    if (newRole === null) return; // Cancelado

    const newEmpresa = prompt('Editar Empresa:', userData.empresa);
    if (newEmpresa === null) return; // Cancelado

    const newSucursal = prompt('Editar Sucursal:', userData.sucursal);
    if (newSucursal === null) return; // Cancelado

    // Actualizar en Firestore
    setDoc(doc(db, 'users_public', userId), {
      username: newUsername,
      role: newRole,
      empresa: newEmpresa,
      sucursal: newSucursal
    }, { merge: true })
      .then(() => {
        alert('Usuario actualizado exitosamente');
        loadUsers();
      })
      .catch((error) => {
        console.error('Error al actualizar usuario:', error);
        alert('Error al actualizar usuario: ' + error.message);
      });
  }

  // Eliminar usuario
  function deleteUser(userId) {
    if (confirm('¿Está seguro de que desea eliminar este usuario?')) {
      deleteDoc(doc(db, 'users_public', userId))
        .then(() => {
          // También eliminar datos privados
          deleteDoc(doc(db, 'users_private', userId));
          alert('Usuario eliminado exitosamente');
          loadUsers();
        })
        .catch((error) => {
          console.error('Error al eliminar usuario:', error);
          alert('Error al eliminar usuario: ' + error.message);
        });
    }
  }

  // Cargar la lista de tickets
  async function loadTickets(statusFilter = null) {
    ticketsList.innerHTML = '';
    let q;
    if (statusFilter) {
      q = query(collection(db, 'tickets'), where('status', '==', statusFilter));
    } else {
      q = collection(db, 'tickets');
    }
    const ticketsSnapshot = await getDocs(q);
    if (ticketsSnapshot.empty) {
      ticketsList.innerHTML = '<p>No hay tickets disponibles.</p>';
      return;
    }
    ticketsSnapshot.forEach((doc) => {
      const ticket = doc.data();
      const ticketDiv = document.createElement('div');
      ticketDiv.classList.add('ticket');

      // Utilizar el formato de ticket proporcionado
      ticketDiv.innerHTML = generateTicketHTML(ticket);

      // Añadir eventos
      const buttonsDiv = document.createElement('div');
      buttonsDiv.classList.add('ticket-buttons');

      const assignButton = document.createElement('button');
      assignButton.textContent = 'Asignar a Auxiliar';
      assignButton.classList.add('assign-button');
      assignButton.addEventListener('click', () => {
        assignTicket(doc.id);
      });
      buttonsDiv.appendChild(assignButton);

      const editButton = document.createElement('button');
      editButton.textContent = 'Editar';
      editButton.classList.add('edit-ticket-button');
      editButton.addEventListener('click', () => {
        editTicket(doc.id, ticket);
      });
      buttonsDiv.appendChild(editButton);

      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Eliminar';
      deleteButton.classList.add('delete-ticket-button');
      deleteButton.addEventListener('click', () => {
        deleteTicket(doc.id);
      });
      buttonsDiv.appendChild(deleteButton);

      const shareButton = document.createElement('button');
      shareButton.textContent = 'Compartir como Imagen';
      shareButton.classList.add('share-button');
      shareButton.addEventListener('click', () => {
        shareTicketAsImage(ticketDiv);
      });
      buttonsDiv.appendChild(shareButton);

      ticketDiv.appendChild(buttonsDiv);

      ticketsList.appendChild(ticketDiv);
    });
  }

  // Manejar los botones de filtro
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const status = button.getAttribute('data-status');
      loadTickets(status);
    });
  });

  // Asignar ticket a un auxiliar
  async function assignTicket(ticketId) {
    try {
      // Obtener lista de auxiliares
      const auxiliaresSnapshot = await getDocs(query(collection(db, 'users_public'), where('role', '==', 'auxiliar')));
      if (auxiliaresSnapshot.empty) {
        alert('No hay auxiliares disponibles para asignar.');
        return;
      }

      // Crear un select para elegir al auxiliar
      const auxiliarSelect = document.createElement('select');
      auxiliaresSnapshot.forEach((doc) => {
        const auxiliar = doc.data();
        const option = document.createElement('option');
        option.value = auxiliar.username;
        option.textContent = auxiliar.username;
        auxiliarSelect.appendChild(option);
      });

      // Mostrar el select en un prompt personalizado
      const auxiliarUsername = await showAuxiliarSelect(auxiliarSelect);
      if (!auxiliarUsername) {
        alert('No se seleccionó un auxiliar.');
        return;
      }

      // Actualizar el ticket
      await updateDoc(doc(db, 'tickets', ticketId), {
        assignedTo: auxiliarUsername
      });

      alert('Ticket asignado a ' + auxiliarUsername);
      // Actualizar la lista de tickets
      loadTickets();
    } catch (error) {
      console.error('Error al asignar ticket:', error);
      alert('Error al asignar ticket: ' + error.message);
    }
  }

  // Función para mostrar el select de auxiliares en un prompt personalizado
  function showAuxiliarSelect(auxiliarSelect) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.classList.add('modal');
      modal.innerHTML = `
        <div class="modal-content">
          <h3>Asignar a Auxiliar</h3>
          ${auxiliarSelect.outerHTML}
          <button id="assign-confirm-button">Asignar</button>
          <button id="assign-cancel-button">Cancelar</button>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#assign-confirm-button').addEventListener('click', () => {
        const selectedAuxiliar = modal.querySelector('select').value;
        document.body.removeChild(modal);
        resolve(selectedAuxiliar);
      });

      modal.querySelector('#assign-cancel-button').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(null);
      });
    });
  }

  // Editar ticket
  function editTicket(ticketId, ticketData) {
    // Mostrar prompts para editar datos
    const newTitle = prompt('Editar Título del Ticket:', ticketData.title);
    if (newTitle === null) return; // Cancelado

    const newDescription = prompt('Editar Descripción del Ticket:', ticketData.description);
    if (newDescription === null) return; // Cancelado

    const newPriority = prompt('Editar Prioridad (alta/media/baja):', ticketData.priority);
    if (newPriority === null) return; // Cancelado

    // Actualizar en Firestore
    updateDoc(doc(db, 'tickets', ticketId), {
      title: newTitle,
      description: newDescription,
      priority: newPriority
    })
      .then(() => {
        alert('Ticket actualizado exitosamente');
        loadTickets();
      })
      .catch((error) => {
        console.error('Error al actualizar ticket:', error);
        alert('Error al actualizar ticket: ' + error.message);
      });
  }

  // Eliminar ticket
  function deleteTicket(ticketId) {
    if (confirm('¿Está seguro de que desea eliminar este ticket?')) {
      deleteDoc(doc(db, 'tickets', ticketId))
        .then(() => {
          alert('Ticket eliminado exitosamente');
          loadTickets();
        })
        .catch((error) => {
          console.error('Error al eliminar ticket:', error);
          alert('Error al eliminar ticket: ' + error.message);
        });
    }
  }

  // Función para compartir un ticket como imagen
  function shareTicketAsImage(ticketElement) {
    html2canvas(ticketElement).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Ticket_${ticketElement.querySelector('h2').textContent.replace('#', '')}.png`;
      link.click();
    }).catch(error => {
      console.error('Error al compartir el ticket como imagen:', error);
      alert('Error al compartir el ticket como imagen.');
    });
  }
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

// Función para generar el HTML del ticket con el formato proporcionado, incluyendo fecha y hora
function generateTicketHTML(ticket) {
  const date = ticket.createdAt.toDate ? ticket.createdAt.toDate() : ticket.createdAt;
  const formattedDate = new Date(date).toLocaleString('es-ES');
  return `
  <div class="ticket-format">
    <header>
      <p class="branch">Sucursal: ${ticket.sucursal}</p>
      <h1 class="brand">${ticket.empresa}</h1>
    </header>
    <div class="content">
      <h2>Ticket #${ticket.id}</h2>
      <p><strong>Fecha de Emisión:</strong> ${formattedDate}</p>
      <div class="title"><strong>Título:</strong> ${ticket.title}</div>
      <div class="description">
        <p><strong>Descripción:</strong></p>
        <div class="description-box">${ticket.description}</div>
      </div>
      <div class="footer">
        <p><strong>Prioridad:</strong> ${ticket.priority}</p>
        <p><strong>Estado:</strong> ${ticket.status}</p>
      </div>
    </div>
  </div>
  `;
}
