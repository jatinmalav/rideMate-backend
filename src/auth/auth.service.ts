import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";

import {
  UserNotFoundError,
  InvalidPasswordError,
  UserAlreadyExistsError,
} from "../errors/auth.errors";

const SALT_ROUNDS = 10;

function signToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
}

export async function registerUser(
  phone: string,
  password: string,
  email?: string,
  name?: string,
) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  try{  
        const result = await pool.query(
        `INSERT INTO users (phone_number, password_hash, name, email)
        VALUES ($1, $2, $3, $4)
        RETURNING id, phone_number, name, email`,
        [phone, hashedPassword, name || null, email || null],
        );
        const user = result.rows[0];
        const token = signToken(user.id);

        return { token, user };
    }
    catch(err: any){
        if (err.code === "23505") {
          throw new UserAlreadyExistsError();
        }
        throw err;
    }   
}

export async function loginUser(phone: string, password: string) {
  const result = await pool.query(
    `SELECT id, phone_number, password_hash, name, email
     FROM users WHERE phone_number = $1`,
    [phone],
  );

  if (result.rowCount === 0) {
    throw new UserNotFoundError();
  }

  const user = result.rows[0];

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new InvalidPasswordError();
  }

  const token = signToken(user.id);

  return {
    token,
    user: {
      id: user.id,
      phone_number: user.phone_number,
      name: user.name,
      email: user.email,
    },
  };
}
