import { Router, Request, Response } from "express";
import { prisma } from "../lib/database.js";
import { log } from "console";

const router = Router();

// GET /users - Get all users
router.get("/", async (req: Request, res: Response) => {
  try {
    const users = await prisma.users.findMany({
      select: {
        remark: true,
        employeeNumber: true,
        id: true,
        displayName: true,
      },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    log("Error fetching users:", error);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

export default router;
