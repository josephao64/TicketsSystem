// auxiliarPanel.js
import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where, updateDoc, doc, Timestamp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
  const logoutButton = document.getElementById('logout-button');
  const assignedTicketsDiv = document.getElementById('assigned-tickets-list');
  const allTicketsDiv = document.getElementById('all-tickets-list');
  const filterButtonsAssigned = document.querySelectorAll('.filter-button-assigned');
  const filterButtonsAll = document.querySelectorAll('.filter-button-all');

  let currentUser = JSON.parse(localStorage.getItem('currentUser'));

  // Verificar si el usuario está autenticado y es auxiliar
  if (!currentUser || currentUser.role !== 'auxiliar') {
    alert('Acceso no autorizado');
    window.location.href = 'index.html';
  } else {
    loadAssignedTickets(); // Cargar todos los tickets asignados inicialmente
    loadAllTickets(); // Cargar todos los tickets inicialmente
  }

  // Cerrar sesión
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  });

  // Cargar los tickets asignados
  async function loadAssignedTickets(statusFilter = null) {
    assignedTicketsDiv.innerHTML = '';
    let q = query(collection(db, 'tickets'), where('assignedTo', '==', currentUser.username));
    if (statusFilter) {
      q = query(q, where('status', '==', statusFilter));
    }
    const ticketsSnapshot = await getDocs(q);
    if (ticketsSnapshot.empty) {
      assignedTicketsDiv.innerHTML = '<p>No tienes tickets asignados.</p>';
      return;
    }
    ticketsSnapshot.forEach((doc) => {
      const ticket = doc.data();
      const ticketDiv = document.createElement('div');
      ticketDiv.classList.add('ticket');

      // Utilizar el formato de ticket proporcionado
      ticketDiv.innerHTML = generateTicketHTML(ticket);

      // Añadir botones para tomar y finalizar ticket
      if (ticket.status === 'abierto') {
        const takeButton = document.createElement('button');
        takeButton.textContent = 'Tomar Ticket';
        takeButton.classList.add('take-ticket-button');
        takeButton.addEventListener('click', () => {
          takeTicket(ticket.id);
        });
        ticketDiv.appendChild(takeButton);
      } else if (ticket.status === 'En Proceso') {
        const finishButton = document.createElement('button');
        finishButton.textContent = 'Finalizar Ticket';
        finishButton.classList.add('finish-ticket-button');
        finishButton.addEventListener('click', () => {
          finishTicket(ticket.id);
        });
        ticketDiv.appendChild(finishButton);
      }

      // Añadir botón para compartir
      const shareButton = document.createElement('button');
      shareButton.textContent = 'Compartir como Imagen';
      shareButton.classList.add('share-button');
      shareButton.addEventListener('click', () => {
        shareTicketAsImage(ticketDiv);
      });
      ticketDiv.appendChild(shareButton);

      assignedTicketsDiv.appendChild(ticketDiv);
    });
  }

  // Cargar todos los tickets
  async function loadAllTickets(statusFilter = null) {
    allTicketsDiv.innerHTML = '';
    let q = collection(db, 'tickets');
    if (statusFilter) {
      q = query(q, where('status', '==', statusFilter));
    }
    const ticketsSnapshot = await getDocs(q);
    ticketsSnapshot.forEach((doc) => {
      const ticket = doc.data();
      const ticketDiv = document.createElement('div');
      ticketDiv.classList.add('ticket');

      // Utilizar el formato de ticket proporcionado
      ticketDiv.innerHTML = generateTicketHTML(ticket);

      // Añadir botón para tomar el ticket si está abierto y no asignado
      if (ticket.status === 'abierto' && !ticket.assignedTo) {
        const takeButton = document.createElement('button');
        takeButton.textContent = 'Tomar Ticket';
        takeButton.classList.add('take-ticket-button');
        takeButton.addEventListener('click', () => {
          takeTicket(ticket.id);
        });
        ticketDiv.appendChild(takeButton);
      }

      // Añadir botón para compartir
      const shareButton = document.createElement('button');
      shareButton.textContent = 'Compartir como Imagen';
      shareButton.classList.add('share-button');
      shareButton.addEventListener('click', () => {
        shareTicketAsImage(ticketDiv);
      });
      ticketDiv.appendChild(shareButton);

      allTicketsDiv.appendChild(ticketDiv);
    });
  }

  // Manejar los botones de filtro para tickets asignados
  filterButtonsAssigned.forEach(button => {
    button.addEventListener('click', () => {
      const status = button.getAttribute('data-status');
      loadAssignedTickets(status);
    });
  });

  // Manejar los botones de filtro para todos los tickets
  filterButtonsAll.forEach(button => {
    button.addEventListener('click', () => {
      const status = button.getAttribute('data-status');
      loadAllTickets(status);
    });
  });

  // Función para tomar un ticket
  async function takeTicket(ticketId) {
    try {
      // Actualizar el ticket en Firestore
      await updateDoc(doc(db, 'tickets', ticketId.toString()), {
        assignedTo: currentUser.username,
        status: 'En Proceso'
      });
      alert('Has tomado el ticket.');
      // Recargar los tickets
      loadAssignedTickets();
      loadAllTickets();
    } catch (error) {
      console.error('Error al tomar el ticket:', error);
      alert('Error al tomar el ticket: ' + error.message);
    }
  }

  // Función para finalizar un ticket
  async function finishTicket(ticketId) {
    try {
      // Actualizar el ticket en Firestore
      await updateDoc(doc(db, 'tickets', ticketId.toString()), {
        status: 'Terminado'
      });
      alert('Has finalizado el ticket.');
      // Recargar los tickets
      loadAssignedTickets();
      loadAllTickets();
    } catch (error) {
      console.error('Error al finalizar el ticket:', error);
      alert('Error al finalizar el ticket: ' + error.message);
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
