// Game providers
const providers = ['JILI', 'PG', 'PP', 'FACHAI', 'SG', 'CQ9', 'JDB', 'RICH88', 'BNG', 'YGG', 'PLAYSTAR', 'NAGA', 'REEVO'];

// Game names
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

// Features pool
const allFeatures = [
  'Free Spins', 'Multipliers', 'Wild Symbols', 'Scatter Pays',
  'Bonus Game', 'Jackpot', 'Megaways', 'Cascading Wins',
  'Sticky Wilds', 'Expanding Wilds', 'Re-spins', 'Gamble Feature',
  'Buy Bonus', 'Progressive Jackpot', 'Cluster Pays'
];

// Generate random features
const getRandomFeatures = () => {
  const count = Math.floor(Math.random() * 4) + 2;
  const shuffled = [...allFeatures].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Determine game type based on name
const getGameType = (name) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('fish') || lowerName.includes('ocean')) {
    return 'fishing';
  } else if (
    lowerName.includes('baccarat') || lowerName.includes('blackjack') ||
    lowerName.includes('poker') || lowerName.includes('holdem') ||
    lowerName.includes('patti') || lowerName.includes('bahar')
  ) {
    return 'card-game';
  } else if (
    lowerName.includes('roulette') || lowerName.includes('sic bo') ||
    lowerName.includes('wheel') || lowerName.includes('dice') ||
    lowerName.includes('ball') || lowerName.includes('casino')
  ) {
    return 'live-casino';
  }
  return 'slot';
};

// Generate games data
export const gamesData = gameNames.map((name, index) => {
  const provider = providers[index % providers.length];
  const isHot = index < 20 || Math.random() > 0.7;
  const isNew = index > gameNames.length - 25 || Math.random() > 0.8;
  const isFeatured = index < 6;
  const gameType = getGameType(name);

  return {
    name,
    provider,
    gameType,
    image: '/images/game-icon.png',
    rtp: parseFloat((94 + Math.random() * 4).toFixed(2)),
    minBet: [0.10, 0.20, 0.50, 1.00][Math.floor(Math.random() * 4)],
    maxBet: [100, 200, 500, 1000, 5000][Math.floor(Math.random() * 5)],
    volatility: ['Low', 'Medium', 'High', 'Very High'][Math.floor(Math.random() * 4)],
    description: `Experience the thrill of ${name}! This exciting ${gameType} game from ${provider} offers amazing features, stunning graphics, and the chance to win big. With an RTP of over 94%, every spin brings you closer to massive rewards.`,
    features: getRandomFeatures(),
    isHot,
    isNew,
    isFeatured,
    rating: parseFloat((4 + Math.random()).toFixed(1)),
    playCount: Math.floor(Math.random() * 100000) + 10000,
    isActive: true
  };
});
