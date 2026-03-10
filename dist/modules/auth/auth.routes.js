import { AuthController } from './auth.controller';
const authController = new AuthController();
export async function authRoutes(app) {
    app.post('/register', authController.register);
    app.post('/login', authController.login);
}
