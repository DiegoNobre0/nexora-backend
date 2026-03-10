import { app } from './app';
// Basta importar o arquivo! Como você tem um 'new Worker(...)' lá dentro, 
// o Node.js vai instanciar e ele começará a ouvir o Redis imediatamente.
import './worker/whatsapp.worker'; 

const start = async () => {
  try {
    await app.listen({ port: 3333, host: '0.0.0.0' });
    console.log('🚀 Nexora API Online na porta 3333');
    console.log('🤖 WhatsApp Worker aguardando mensagens...');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();