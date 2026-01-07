// Comprehensive mock promotions data

export const promotionCategories = [
  { id: 'ALL', name: 'ALL', icon: '🎁' },
  { id: 'SLOTS', name: 'SLOTS', icon: '🎰' },
  { id: 'CASINO', name: 'CASINO', icon: '🎲' },
  { id: 'SPORT', name: 'SPORT', icon: '⚽' },
  { id: 'VIP', name: 'VIP', icon: '👑' },
  { id: 'UNLIMITED', name: 'UNLIMITED', icon: '♾️' },
];

export const mockPromotions = [
  {
    id: 1,
    title: '100% Welcome Bonus',
    subtitle: 'Double your first deposit up to $500',
    image: 'https://www.begambleaware.org/sites/default/files/2023-03/welcome-bonus.jpg',
    category: 'SLOTS',
    bonusAmount: '100%',
    maxBonus: 500,
    minDeposit: 20,
    wageringRequirement: 35,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    description: `
      <p>Start your gaming journey with a massive 100% Welcome Bonus! We'll match your first deposit up to $500, giving you double the funds to explore our incredible selection of slot games.</p>
      <h4>How it works:</h4>
      <ul>
        <li>Make your first deposit of $20 or more</li>
        <li>Bonus is automatically credited to your account</li>
        <li>Start playing your favorite slots immediately</li>
      </ul>
    `,
    terms: [
      'Minimum deposit: $20',
      'Maximum bonus: $500',
      'Wagering requirement: 35x bonus amount',
      'Valid for slot games only',
      'Bonus expires after 30 days',
      'One bonus per player/household',
      'General T&Cs apply'
    ],
    isActive: true,
    isFeatured: true
  },
  {
    id: 2,
    title: '50% Reload Bonus',
    subtitle: 'Every deposit gets 50% extra',
    image: 'https://www.begambleaware.org/sites/default/files/2023-03/reload-bonus.jpg',
    category: 'SLOTS',
    bonusAmount: '50%',
    maxBonus: 200,
    minDeposit: 20,
    wageringRequirement: 30,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    description: `
      <p>Keep the wins coming with our generous 50% Reload Bonus! Available on every deposit, this bonus gives you extra playing power whenever you need it.</p>
    `,
    terms: [
      'Minimum deposit: $20',
      'Maximum bonus: $200',
      'Wagering requirement: 30x',
      'Can be claimed unlimited times',
      'Valid for all slot games'
    ],
    isActive: true,
    isFeatured: false
  },
  {
    id: 3,
    title: 'Live Casino Cashback',
    subtitle: '15% weekly cashback on live games',
    image: 'https://www.begambleaware.org/sites/default/files/2023-03/cashback.jpg',
    category: 'CASINO',
    bonusAmount: '15%',
    maxBonus: 1000,
    minDeposit: 0,
    wageringRequirement: 5,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    description: `
      <p>Play your favorite live casino games with confidence! Get 15% of your weekly losses back, up to $1000. It's our way of saying thank you for being a loyal player.</p>
    `,
    terms: [
      'Cashback calculated on net losses',
      'Credited every Monday',
      'Maximum cashback: $1000 per week',
      '5x wagering requirement',
      'Valid for live casino games only'
    ],
    isActive: true,
    isFeatured: true
  },
  {
    id: 4,
    title: 'Sports Free Bet',
    subtitle: 'Get $50 in free bets weekly',
    image: 'https://www.begambleaware.org/sites/default/files/2023-03/free-bet.jpg',
    category: 'SPORT',
    bonusAmount: '$50',
    maxBonus: 50,
    minDeposit: 100,
    wageringRequirement: 1,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    description: `
      <p>Sports betting fans rejoice! Place $100 in bets each week and receive $50 in free bets. Use them on any sport, any market, any odds!</p>
    `,
    terms: [
      'Minimum weekly betting: $100',
      'Free bets credited on Mondays',
      'Free bet stake not included in winnings',
      'Valid for 7 days',
      'Minimum odds: 1.50'
    ],
    isActive: true,
    isFeatured: false
  },
  {
    id: 5,
    title: 'VIP Exclusive Bonus',
    subtitle: 'Up to 200% match for VIP members',
    image: 'https://www.begambleaware.org/sites/default/files/2023-03/vip-bonus.jpg',
    category: 'VIP',
    bonusAmount: '200%',
    maxBonus: 5000,
    minDeposit: 500,
    wageringRequirement: 25,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    description: `
      <p>As a valued VIP member, you deserve the best. Enjoy an exclusive 200% match bonus up to $5000 with lower wagering requirements!</p>
    `,
    terms: [
      'VIP members only',
      'Minimum deposit: $500',
      'Maximum bonus: $5000',
      'Wagering requirement: 25x',
      'Personal account manager assistance available'
    ],
    isActive: true,
    isFeatured: true
  },
  {
    id: 6,
    title: 'Unlimited Free Spins',
    subtitle: 'No cap on free spin winnings',
    image: 'https://www.begambleaware.org/sites/default/files/2023-03/free-spins.jpg',
    category: 'UNLIMITED',
    bonusAmount: '100 Spins',
    maxBonus: null,
    minDeposit: 50,
    wageringRequirement: 40,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    description: `
      <p>Get 100 free spins with NO WIN CAP! Whatever you win from your free spins is yours to keep (subject to wagering). Play selected slot games and spin your way to massive wins!</p>
    `,
    terms: [
      'Minimum deposit: $50',
      '100 free spins credited in batches of 20',
      'No maximum win limit',
      'Wagering requirement: 40x winnings',
      'Valid on selected slots only'
    ],
    isActive: true,
    isFeatured: false
  },
  {
    id: 7,
    title: 'Daily Drops & Wins',
    subtitle: '$2,000,000 monthly prize pool',
    image: 'https://www.begambleaware.org/sites/default/files/2023-03/prize-pool.jpg',
    category: 'SLOTS',
    bonusAmount: '$2M',
    maxBonus: 50000,
    minDeposit: 0,
    wageringRequirement: 0,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    description: `
      <p>Join our Daily Drops & Wins tournament! Every day, random prizes drop while you play. Plus, compete on our leaderboard for a share of the $2,000,000 monthly prize pool!</p>
    `,
    terms: [
      'Play qualifying games to participate',
      'Random prizes drop daily',
      'Weekly tournaments with leaderboard prizes',
      'No wagering on prize winnings',
      'Prizes paid as cash'
    ],
    isActive: true,
    isFeatured: true
  },
  {
    id: 8,
    title: 'Refer a Friend',
    subtitle: 'Get $50 for each friend',
    image: 'https://www.begambleaware.org/sites/default/files/2023-03/refer-friend.jpg',
    category: 'UNLIMITED',
    bonusAmount: '$50',
    maxBonus: null,
    minDeposit: 0,
    wageringRequirement: 10,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    description: `
      <p>Share the fun and get rewarded! Refer your friends to Team33 and receive $50 for each friend who signs up and makes their first deposit. There's no limit to how many friends you can refer!</p>
    `,
    terms: [
      'Friend must be new to Team33',
      'Friend must deposit minimum $20',
      'Bonus credited after friend\'s first deposit',
      'No limit on referrals',
      '10x wagering requirement'
    ],
    isActive: true,
    isFeatured: false
  },
  {
    id: 9,
    title: 'Weekend Warrior',
    subtitle: '25% bonus every weekend',
    image: 'https://www.begambleaware.org/sites/default/files/2023-03/weekend-bonus.jpg',
    category: 'CASINO',
    bonusAmount: '25%',
    maxBonus: 250,
    minDeposit: 30,
    wageringRequirement: 25,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    description: `
      <p>Make your weekends extra special with our Weekend Warrior bonus! Deposit on Saturday or Sunday and receive a 25% bonus up to $250 to use on all casino games.</p>
    `,
    terms: [
      'Available Saturday and Sunday only',
      'Minimum deposit: $30',
      'Maximum bonus: $250',
      'Valid for all casino games',
      'One claim per weekend'
    ],
    isActive: true,
    isFeatured: false
  },
  {
    id: 10,
    title: 'Birthday Bonus',
    subtitle: 'Special gift on your special day',
    image: 'https://www.begambleaware.org/sites/default/files/2023-03/birthday.jpg',
    category: 'VIP',
    bonusAmount: '$100',
    maxBonus: 100,
    minDeposit: 0,
    wageringRequirement: 20,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    description: `
      <p>It's your birthday, and we want to celebrate with you! Receive a free $100 bonus on your birthday - no deposit required. Just our way of wishing you a happy birthday!</p>
    `,
    terms: [
      'Must have verified account',
      'Birthday must be verified',
      'Credited on your birthday',
      'Valid for 7 days',
      '20x wagering requirement'
    ],
    isActive: true,
    isFeatured: false
  }
];

export default mockPromotions;
