import { check } from "express-validator";
import { signup, signin, logout } from "../controllers/authController.js";

export default (app) => {
    app.post('/api/signup', [
        check('email').isEmail().withMessage('Invalid email format'),
        check('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    ], signup);
    app.post('/api/signin', [
        check('email').isEmail().withMessage('Invalid email format'),
        check('password').exists().withMessage('Password is required'),
    ], signin);
    app.post('/api/logout', logout);
};
