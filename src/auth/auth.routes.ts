import { Router } from "express";
import { registerUser, loginUser } from "./auth.service";

const router = Router();

router.post("/register", async (req, res) => {
  const { phone, password, email, name } = req.body;

  // Validation can be moved to the service or a dedicated validation middleware
  const data = await registerUser(phone, password, name, email);
  res.status(201).json(data);
});

router.post("/login", async (req, res) => {
  const { phone, password } = req.body;

  // Basic validation remains, but more complex logic should be in the service
  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password required" });
  }

  const data = await loginUser(phone, password);
  res.json(data);
});

export default router;
