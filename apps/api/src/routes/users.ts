import { Router, Request, Response } from 'express';
import { prisma } from '../lib/database.js';
import { log } from 'console';

const router = Router();

interface CreateUserBody {
  name: string;
  email: string;
}

// GET /users - Get all users
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    res.json({ success: true, data: users });
  } catch (error) {
    log('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// GET /users/:id - Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, data: user });
  } catch (error) {
    log('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// POST /users - Create new user
router.post('/', async (req: Request<{}, {}, CreateUserBody>, res: Response) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and email are required' 
      });
    }
    
    const user = await prisma.user.create({
      data: { name, email },
    });
    
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    log('Error creating user:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already exists' 
      });
    }
    
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// PUT /users/:id - Update user
router.put('/:id', async (req: Request<{ id: string }, {}, CreateUserBody>, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = await prisma.user.update({
      where: { id },
      data: { 
        ...(name && { name }),
        ...(email && { email })
      },
    });
    
    res.json({ success: true, data: user });
  } catch (error: any) {
    log('Error updating user:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already exists' 
      });
    }
    
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// DELETE /users/:id - Delete user
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await prisma.user.delete({ where: { id } });
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    log('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

export default router;