// Comprehensive mock games data
import gameIcon from '../images/Game icon .png';

// Providers with their codes
export const providers = [
  { id: 'ALL', name: 'ALL', logo: null },
  { id: 'JILI', name: 'JILI', logo: 'https://www.gamesapi.net/uploads/1718339665.webp' },
  { id: 'PG', name: 'PG Soft', logo: 'https://www.gamesapi.net/uploads/1718339780.webp' },
  { id: 'PP', name: 'Pragmatic Play', logo: 'https://www.gamesapi.net/uploads/1718339800.webp' },
  { id: 'FACHAI', name: 'FA CHAI', logo: 'https://www.gamesapi.net/uploads/1718339720.webp' },
  { id: 'SG', name: 'Spade Gaming', logo: 'https://www.gamesapi.net/uploads/1718339820.webp' },
  { id: 'CQ9', name: 'CQ9', logo: 'https://www.gamesapi.net/uploads/1718339700.webp' },
  { id: 'JDB', name: 'JDB', logo: 'https://www.gamesapi.net/uploads/1718339740.webp' },
  { id: 'RICH88', name: 'RICH88', logo: 'https://www.gamesapi.net/uploads/1718339760.webp' },
  { id: 'BNG', name: 'BNG', logo: 'https://www.gamesapi.net/uploads/1718339680.webp' },
  { id: 'YGG', name: 'Yggdrasil', logo: 'https://www.gamesapi.net/uploads/1718339840.webp' },
  { id: 'PLAYSTAR', name: 'PlayStar', logo: 'https://www.gamesapi.net/uploads/1718339790.webp' },
  { id: 'NAGA', name: 'NAGA', logo: 'https://www.gamesapi.net/uploads/1718339770.webp' },
  { id: 'REEVO', name: 'REEVO', logo: 'https://www.gamesapi.net/uploads/1718339810.webp' },
];

// Use local game icon for all games
const gameImage = gameIcon;

// Generate comprehensive game list
const gameNames = [
  'Heroes', 'Mega 7', 'Queen Of Fire', 'Space Conquest', 'Pan Fairy',
  'Double Flame', 'Triple Panda', 'Fist Of Gold', 'Royale House', 'Golden Lotus',
  'Lucky Koi', 'Book Of Myth', 'Dragon Tiger', 'Fortune Gods', 'Money Tree',
  'Phoenix Rises', 'Golden Empire', 'Super Ace', 'Boxing King', 'Crazy 777',
  'Wild Bandito', 'Mahjong Ways', 'Lucky Neko', 'Gates Of Olympus', 'Starlight Princess',
  'Sweet Bonanza', 'Sugar Rush', 'Big Bass', 'Wolf Gold', 'Gems Bonanza',
  'Aztec Gems', 'Hot Fiesta', 'Fruit Party', 'Great Rhino', 'Buffalo King',
  'Mystic Fortune', 'Treasure Wild', 'Ocean King', 'Golden Fish', 'Fishing God',
  'Happy Fish', 'Mega Fishing', 'Royal Fishing', 'Dragon Master', 'Thunder God',
  'Medusa', 'Age of Gods', 'Zeus', 'Athena', 'Poseidon',
  'Fortune Tiger', 'Lucky Cola', 'Baccarat Deluxe', 'Blackjack Pro', 'Poker King',
  'Texas Holdem', 'Teen Patti', 'Andar Bahar', 'Dragon Bonus', 'Lucky 9',
  'Roulette Master', 'Sic Bo', 'Fan Tan', 'Pai Gow', 'Casino War',
  'Money Wheel', 'Dream Catcher', 'Crazy Time', 'Lightning Dice', 'Mega Ball',
  'Cash Hunt', 'Coin Flip', 'Pachinko', 'Top Card', 'Boom City',
  'Speed Baccarat', 'Auto Roulette', 'Power Blackjack', 'Free Bet BJ', 'Infinite BJ',
  'Golden Wealth', 'Lucky Strike', 'Money Rain', 'Jackpot City', 'Diamond Rush',
  'Emerald Dream', 'Ruby Fortune', 'Sapphire Star', 'Topaz Treasure', 'Amethyst Magic',
  'Platinum Play', 'Gold Rush', 'Silver Storm', 'Bronze Beat', 'Iron Fortune',
  'Crystal Cave', 'Mystic Moon', 'Solar Flare', 'Cosmic Cash', 'Galaxy Gold',
  'Neon Nights', 'Retro Reels', 'Classic Slots', 'Vintage Vegas', 'Old School'
];

const providerIds = providers.filter(p => p.id !== 'ALL').map(p => p.id);

export const mockGames = gameNames.map((name, index) => {
  const provider = providerIds[index % providerIds.length];
  const isHot = index < 20 || Math.random() > 0.7;
  const isNew = index > gameNames.length - 25 || Math.random() > 0.8;
  const isFeatured = index < 6;

  // Determine game type based on name keywords
  let gameType = 'slot';
  if (name.toLowerCase().includes('fish') || name.toLowerCase().includes('ocean')) {
    gameType = 'fishing';
  } else if (name.toLowerCase().includes('baccarat') || name.toLowerCase().includes('blackjack') ||
    name.toLowerCase().includes('poker') || name.toLowerCase().includes('holdem') ||
    name.toLowerCase().includes('patti') || name.toLowerCase().includes('bahar')) {
    gameType = 'card-game';
  } else if (name.toLowerCase().includes('roulette') || name.toLowerCase().includes('sic bo') ||
    name.toLowerCase().includes('wheel') || name.toLowerCase().includes('dice') ||
    name.toLowerCase().includes('ball') || name.toLowerCase().includes('casino')) {
    gameType = 'live-casino';
  }

  return {
    id: index + 1,
    name,
    image: gameImage,
    provider,
    gameType,
    isHot,
    isNew,
    isFeatured,
    rtp: (94 + Math.random() * 4).toFixed(2) * 1,
    minBet: [0.10, 0.20, 0.50, 1.00][Math.floor(Math.random() * 4)],
    maxBet: [100, 200, 500, 1000, 5000][Math.floor(Math.random() * 5)],
    volatility: ['Low', 'Medium', 'High', 'Very High'][Math.floor(Math.random() * 4)],
    description: `Experience the thrill of ${name}! This exciting ${gameType} game from ${provider} offers amazing features, stunning graphics, and the chance to win big. With an RTP of over 94%, every spin brings you closer to massive rewards.`,
    features: getRandomFeatures(),
    rating: (4 + Math.random()).toFixed(1) * 1,
    playCount: Math.floor(Math.random() * 100000) + 10000
  };
});

function getRandomFeatures() {
  const allFeatures = [
    'Free Spins', 'Multipliers', 'Wild Symbols', 'Scatter Pays',
    'Bonus Game', 'Jackpot', 'Megaways', 'Cascading Wins',
    'Sticky Wilds', 'Expanding Wilds', 'Re-spins', 'Gamble Feature',
    'Buy Bonus', 'Progressive Jackpot', 'Cluster Pays'
  ];

  const count = Math.floor(Math.random() * 4) + 2;
  const shuffled = allFeatures.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export default mockGames;
