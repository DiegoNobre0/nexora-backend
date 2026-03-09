import { app } from './app'; // Deixe assim!
import 'dotenv/config';
const PORT = Number(process.env.PORT) || 3333;
async function bootstrap() {
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🚀 Servidor Nexora rodando na porta ${PORT}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
bootstrap();
