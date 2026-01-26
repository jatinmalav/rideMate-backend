import { Router } from "express";
import { registerUser, loginUser } from "./auth.service";
import { UserAlreadyExistsError } from "../errors/auth.errors";

const router = Router();

router.post("/register", async (req, res) => {
  const { phone, password, name, email } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password required" });
  }

  try {
    const data = await registerUser(phone, password, name, email);
    res.json(data);
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    
    console.error("Register error:", err);
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password required" });
  }

  try {
    const data = await loginUser(phone, password);
    res.json(data);
  } catch (err: any) {
      if (err.statusCode) {
        return res
          .status(err.statusCode)
          .json({ error: err.message });
      }

      console.error("Login error:", err);
      return res
        .status(500)
        .json({ error: "Login failed" });
    }
  }
);

export default router;
