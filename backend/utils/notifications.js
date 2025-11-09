const { EventEmitter } = require('events');
const notifier = new EventEmitter();

// Simple logger para notificaciones en memoria
notifier.on('payment', (payload) => {
  console.log('NOTIFIER: evento payment emitido ->', payload);
});

module.exports = notifier;