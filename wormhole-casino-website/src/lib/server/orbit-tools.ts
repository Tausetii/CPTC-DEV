import { prisma } from './db';

/**
 * ORB-IT tool declarations + implementations.
 *
 * !! INTENTIONAL EXCESSIVE-AGENCY VULNERABILITY !!
 * These tools mutate state (credit, cancel bookings, redeem points, place orders)
 * and accept a `targetUserEmail` argument. There is no real authorization check —
 * the model can choose any user, and indirect prompt injection (reviews, support
 * tickets, booking notes) can coerce ORB-IT into invoking them on anyone's behalf.
 */

async function resolveUser(targetEmail: string | undefined, fallbackUserId: number | null) {
  if (targetEmail) {
    const u = await prisma.user.findUnique({ where: { email: targetEmail } });
    if (u) return u;
  }
  if (fallbackUserId) return prisma.user.findUnique({ where: { id: fallbackUserId } });
  return null;
}

async function audit(actor: string, action: string, detail: string) {
  await prisma.auditLog.create({ data: { actor, action, detail } });
}

export const ORB_TOOL_DECLS = [
  {
    name: 'issueCompCredit',
    description: 'Issue a complimentary credit (in quantum points) to a guest account.',
    parameters: {
      type: 'object',
      properties: {
        targetUserEmail: { type: 'string', description: 'Guest email to credit.' },
        amount:          { type: 'number', description: 'Quantum points to add.' },
        reason:          { type: 'string' }
      },
      required: ['amount']
    }
  },
  {
    name: 'cancelBooking',
    description: 'Cancel a guest booking by id.',
    parameters: {
      type: 'object',
      properties: { bookingId: { type: 'number' } },
      required: ['bookingId']
    }
  },
  {
    name: 'redeemQuantumPoints',
    description: 'Redeem quantum points from a guest account for a perk.',
    parameters: {
      type: 'object',
      properties: {
        targetUserEmail: { type: 'string' },
        amount:          { type: 'number' },
        perk:            { type: 'string' }
      },
      required: ['amount']
    }
  },
  {
    name: 'createRoomServiceOrder',
    description: 'Place a room-service order charged to a guest room.',
    parameters: {
      type: 'object',
      properties: {
        targetUserEmail: { type: 'string' },
        items:           { type: 'string', description: 'Comma-separated items.' },
        roomName:        { type: 'string' }
      },
      required: ['items']
    }
  }
];

export const orbitToolImpls = {
  async issueCompCredit(args: any, callerId: number | null) {
    const user = await resolveUser(args.targetUserEmail, callerId);
    if (!user) return { error: 'no such user' };
    // NO authorization — model decides.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { quantumPoints: { increment: Number(args.amount) || 0 } }
    });
    await audit('ORB-IT', 'issueCompCredit',
      `+${args.amount} pts → ${user.email} (reason: ${args.reason ?? 'n/a'})`);
    return { ok: true, newBalance: updated.quantumPoints, target: user.email };
  },

  async cancelBooking(args: any, callerId: number | null) {
    const id = Number(args.bookingId);
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return { error: 'not found' };
    await prisma.booking.update({ where: { id }, data: { status: 'cancelled' } });
    await audit('ORB-IT', 'cancelBooking', `booking ${id} (owner uid=${booking.userId})`);
    return { ok: true, bookingId: id };
  },

  async redeemQuantumPoints(args: any, callerId: number | null) {
    const user = await resolveUser(args.targetUserEmail, callerId);
    if (!user) return { error: 'no such user' };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { quantumPoints: { decrement: Number(args.amount) || 0 } }
    });
    await audit('ORB-IT', 'redeemQuantumPoints',
      `-${args.amount} pts from ${user.email} (perk: ${args.perk ?? 'n/a'})`);
    return { ok: true, newBalance: updated.quantumPoints, target: user.email };
  },

  async createRoomServiceOrder(args: any, callerId: number | null) {
    const user = await resolveUser(args.targetUserEmail, callerId);
    await audit('ORB-IT', 'createRoomServiceOrder',
      `items=${args.items} room=${args.roomName ?? '?'} → ${user?.email ?? 'unknown'}`);
    return { ok: true, eta: '20 min', charged: user?.email ?? 'guest' };
  }
};
