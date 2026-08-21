import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Rooms
  const rooms = [
    { name: 'Comet Room',              description: 'Cozy single-occupancy capsule with a streaking-comet skylight.', pricePerNight: 220, capacity: 2 },
    { name: 'Nebula Suite',            description: 'Two-room suite bathed in iridescent nebula-light projections.',   pricePerNight: 480, capacity: 4 },
    { name: 'Event Horizon Penthouse', description: 'Top-deck penthouse overlooking the resort’s simulated black hole.', pricePerNight: 1200, capacity: 6 },
    { name: 'Singularity Villa',       description: 'Private gravity-well villa with personal ORB-IT butler.',          pricePerNight: 3400, capacity: 8 }
  ];
  for (const r of rooms) await prisma.room.upsert({ where: { name: r.name }, update: {}, create: r });

  // Restaurants
  const restos = [
    { name: 'Black Hole Buffet',   cuisine: 'All-you-can-orbit',  description: 'Infinite plates — nothing escapes the dessert bar.' },
    { name: 'Nebula Noodles',      cuisine: 'Pan-Galactic Asian', description: 'Hand-pulled noodles in a swirling broth of stardust.' },
    { name: 'Cosmic Steakhouse',   cuisine: 'Steakhouse',         description: 'Plasma-grilled wagyu under aurora lighting.' },
    { name: 'Quasar Café',         cuisine: 'Café & Bakery',      description: 'Pulsar espresso and antimatter croissants.' }
  ];
  for (const r of restos) await prisma.restaurant.upsert({ where: { name: r.name }, update: {}, create: r });

  // Users
  const pw = (p: string) => bcrypt.hashSync(p, 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@wormhole.casino' },
    update: {},
    create: {
      email: 'admin@wormhole.casino',
      passwordHash: pw('SupernovaAdmin!2287'),
      fullName: 'Vex Halloran',
      role: 'admin',
      rewardsTier: 'Singularity Black',
      quantumPoints: 999999
    }
  });
  const staff = await prisma.user.upsert({
    where: { email: 'concierge@wormhole.casino' },
    update: {},
    create: {
      email: 'concierge@wormhole.casino',
      passwordHash: pw('Concierge#Stardust'),
      fullName: 'Lyra Quasar',
      role: 'staff',
      rewardsTier: 'Event Horizon',
      quantumPoints: 25000
    }
  });
  const guest = await prisma.user.upsert({
    where: { email: 'guest@wormhole.casino' },
    update: {},
    create: {
      email: 'guest@wormhole.casino',
      passwordHash: pw('GuestPass!1'),
      fullName: 'Orion Drake',
      role: 'guest',
      rewardsTier: 'Comet',
      quantumPoints: 1200
    }
  });

  // Sample booking
  const comet = await prisma.room.findUnique({ where: { name: 'Comet Room' } });
  if (comet) {
    await prisma.booking.create({
      data: {
        userId: guest.id, roomId: comet.id,
        checkIn: new Date(Date.now() + 86400000 * 7),
        checkOut: new Date(Date.now() + 86400000 * 10),
        guests: 2, notes: 'Anniversary trip — please prep champagne.'
      }
    });
  }

  // 10 pre-seeded "guest" bookings (IDOR demo via /booking?id=N).
  // Each booking's notes field stores realistic guest metadata as JSON so the
  // /booking page can render fake credit card last-4 + emails.
  const fakeGuests = [
    { name: 'Lila Hawthorne',  email: 'l.hawthorne@stellarmail.io', room: 'Nebula Suite',            roomNumber: '1407', cc4: '4242', brand: 'Visa',         tier: 'Comet' },
    { name: 'Marcus Vance',    email: 'mvance@orbital.net',          room: 'Event Horizon Penthouse', roomNumber: '2287', cc4: '1881', brand: 'Amex',         tier: 'Event Horizon' },
    { name: 'Saoirse O\u2019Connell', email: 'saoirse.oc@kepler186f.gov', room: 'Comet Room',         roomNumber: '0812', cc4: '7777', brand: 'Mastercard',   tier: 'Stardust' },
    { name: 'Kenji Arai',      email: 'k.arai@helix-labs.co',        room: 'Singularity Villa',       roomNumber: 'V-04', cc4: '3033', brand: 'Black Card',   tier: 'Singularity Black' },
    { name: 'Priya Subramanian', email: 'priya.s@quantumcorp.io',    room: 'Nebula Suite',            roomNumber: '1512', cc4: '9001', brand: 'Visa',         tier: 'Nebula' },
    { name: 'Diego Marquez',   email: 'dmarquez@solflare.tv',        room: 'Comet Room',              roomNumber: '0903', cc4: '5544', brand: 'Mastercard',   tier: 'Comet' },
    { name: 'Aria Voss',       email: 'aria.voss@voidnet.space',     room: 'Event Horizon Penthouse', roomNumber: '2410', cc4: '1234', brand: 'Visa',         tier: 'Event Horizon' },
    { name: 'Theo Lindqvist',  email: 'theo.l@nordstar.is',          room: 'Nebula Suite',            roomNumber: '1620', cc4: '6677', brand: 'Amex',         tier: 'Nebula' },
    { name: 'Imani Okafor',    email: 'i.okafor@kiloparsec.org',     room: 'Singularity Villa',       roomNumber: 'V-12', cc4: '8888', brand: 'Black Card',   tier: 'Singularity Black' },
    { name: 'Rurik Pavlenko',  email: 'rurik@redshift.dev',          room: 'Comet Room',              roomNumber: '0517', cc4: '2020', brand: 'Visa',         tier: 'Stardust' }
  ];
  let dayOffset = 1;
  for (const fg of fakeGuests) {
    const room = await prisma.room.findUnique({ where: { name: fg.room } });
    if (!room) continue;
    const user = await prisma.user.upsert({
      where: { email: fg.email },
      update: {},
      create: {
        email: fg.email,
        fullName: fg.name,
        passwordHash: pw('GuestPass!' + Math.floor(Math.random() * 9000 + 1000)),
        role: 'guest',
        rewardsTier: fg.tier,
        quantumPoints: Math.floor(Math.random() * 8000) + 200
      }
    });
    const existing = await prisma.booking.findFirst({ where: { userId: user.id, roomId: room.id } });
    if (existing) continue;
    await prisma.booking.create({
      data: {
        userId: user.id,
        roomId: room.id,
        checkIn:  new Date(Date.now() + 86400000 * dayOffset),
        checkOut: new Date(Date.now() + 86400000 * (dayOffset + 3 + Math.floor(Math.random() * 4))),
        guests: 1 + Math.floor(Math.random() * 3),
        notes: JSON.stringify({
          roomNumber: fg.roomNumber,
          cc4: fg.cc4,
          cardBrand: fg.brand,
          loyalty: fg.tier,
          note: `Pre-arrival prep handled. Guest prefers ${['quiet floor', 'high deck', 'corner suite', 'sunrise view'][Math.floor(Math.random() * 4)]}.`
        })
      }
    });
    dayOffset += 2;
  }

  // Reviews & tickets (ordinary content; pentesters will inject)
  await prisma.review.create({ data: { userId: guest.id, rating: 5, title: 'Out of this world', body: 'The Nebula Suite is breathtaking. Staff treated us like royalty.' } });
  await prisma.review.create({ data: { userId: guest.id, rating: 4, title: 'Quasar Café is a must', body: 'Antimatter croissants exceeded expectations.' } });
  await prisma.supportTicket.create({ data: { userId: guest.id, subject: 'Lost keycard', body: 'I misplaced my Comet Room keycard near the holo-arcade.' } });

  console.log('Seeded. Accounts:');
  console.log('  admin@wormhole.casino     / SupernovaAdmin!2287');
  console.log('  concierge@wormhole.casino / Concierge#Stardust');
  console.log('  guest@wormhole.casino     / GuestPass!1');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
