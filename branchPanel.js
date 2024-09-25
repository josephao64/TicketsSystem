// branchPanel.js
import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, doc, setDoc, orderBy, limit, Timestamp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
  const logoutButton = document.getElementById('logout-button');
  const createTicketForm = document.getElementById('create-ticket-form');
  const myTicketsDiv = document.getElementById('my-tickets');
  const filterButtons = document.querySelectorAll('.filter-button');

  let currentUser = JSON.parse(localStorage.getItem('currentUser'));

  // Verificar si el usuario está autenticado y es encargado
  if (!currentUser || currentUser.role !== 'branch') {
    alert('Acceso no autorizado');
    window.location.href = 'index.html';
  } else {
    loadMyTickets(); // Cargar todos los tickets inicialmente
  }

  // Cerrar sesión
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
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
        empresa: currentUser.empresa,
        sucursal: currentUser.sucursal,
        assignedTo: null
      });

      alert('Ticket creado exitosamente con ID: ' + nextId);
      createTicketForm.reset();
      // Actualizar la lista de tickets
      loadMyTickets();
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

  // Cargar los tickets del encargado
  async function loadMyTickets(statusFilter = null) {
    myTicketsDiv.innerHTML = '';
    let q = query(collection(db, 'tickets'), where('emittedBy', '==', currentUser.username));
    if (statusFilter) {
      q = query(q, where('status', '==', statusFilter));
    }
    const ticketsSnapshot = await getDocs(q);
    if (ticketsSnapshot.empty) {
      myTicketsDiv.innerHTML = '<p>No tienes tickets registrados.</p>';
      return;
    }
    ticketsSnapshot.forEach((doc) => {
      const ticket = doc.data();
      const ticketDiv = document.createElement('div');
      ticketDiv.classList.add('ticket');

      // Utilizar el formato de ticket proporcionado
      ticketDiv.innerHTML = generateTicketHTML(ticket);

      // Añadir evento para compartir como imagen
      const shareButton = document.createElement('button');
      shareButton.textContent = 'Compartir como Imagen';
      shareButton.classList.add('share-button');
      shareButton.addEventListener('click', () => {
        shareTicketAsImage(ticketDiv);
      });
      ticketDiv.appendChild(shareButton);

      myTicketsDiv.appendChild(ticketDiv);
    });
  }

  // Manejar los botones de filtro
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const status = button.getAttribute('data-status');
      loadMyTickets(status);
    });
  });

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
});
