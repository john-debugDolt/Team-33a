// Promotions seed data
const now = new Date();
const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

export const promotionsData = [
  {
    title: 'Welcome Bonus',
    subtitle: '100% First Deposit Match',
    image: 'https://images.unsplash.com/photo-1518893063132-36e46dbe2428?w=800',
    category: 'SLOTS',
    bonusAmount: '100%',
    maxBonus: 500,
    minDeposit: 20,
    wageringRequirement: 35,
    validFrom: now,
    validUntil: threeMonthsLater,
    description: '<p>Start your gaming journey with a bang! Get a <strong>100% match bonus</strong> on your first deposit up to $500.</p><p>This is the perfect way to explore our amazing slot games with extra funds.</p>',
    terms: [
      'Minimum deposit of $20 required',
      'Maximum bonus amount is $500',
      'Wagering requirement: 35x bonus amount',
      'Valid for slot games only',
      'Must be claimed within 7 days of registration',
      'One bonus per player/household'
    ],
    isActive: true,
    isFeatured: true
  },
  {
    title: 'Reload Bonus',
    subtitle: '50% on Every Deposit',
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800',
    category: 'SLOTS',
    bonusAmount: '50%',
    maxBonus: 200,
    minDeposit: 20,
    wageringRequirement: 30,
    validFrom: now,
    validUntil: threeMonthsLater,
    description: '<p>Keep the fun going with our <strong>50% reload bonus</strong> on every deposit!</p>',
    terms: [
      'Minimum deposit of $20 required',
      'Maximum bonus amount is $200',
      'Wagering requirement: 30x bonus amount',
      'Can be claimed once per day'
    ],
    isActive: true,
    isFeatured: false
  },
  {
    title: 'Live Casino Cashback',
    subtitle: '15% Weekly Cashback',
    image: 'https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=800',
    category: 'CASINO',
    bonusAmount: '15%',
    maxBonus: 1000,
    minDeposit: 0,
    wageringRequirement: 5,
    validFrom: now,
    validUntil: threeMonthsLater,
    description: '<p>Get back <strong>15% of your weekly losses</strong> in our live casino section!</p>',
    terms: [
      'Applies to net losses in live casino games',
      'Credited every Monday',
      'Maximum cashback is $1,000 per week',
      'Wagering requirement: 5x cashback amount'
    ],
    isActive: true,
    isFeatured: true
  },
  {
    title: 'Sports Free Bet',
    subtitle: '$50 Free Bet on Sports',
    image: 'https://images.unsplash.com/photo-1461896836934- voices0d55e5c?w=800',
    category: 'SPORT',
    bonusAmount: '$50',
    maxBonus: 50,
    minDeposit: 50,
    wageringRequirement: 10,
    validFrom: now,
    validUntil: oneMonthLater,
    description: '<p>Place your bets with confidence! Get a <strong>$50 free bet</strong> for sports betting.</p>',
    terms: [
      'Deposit $50 or more to qualify',
      'Free bet must be used within 7 days',
      'Minimum odds of 1.50 required',
      'Winnings from free bet exclude stake'
    ],
    isActive: true,
    isFeatured: false
  },
  {
    title: 'VIP Diamond Rewards',
    subtitle: 'Exclusive 25% Bonus',
    image: 'https://images.unsplash.com/photo-1534470397-5d4e51a10156?w=800',
    category: 'VIP',
    bonusAmount: '25%',
    maxBonus: 5000,
    minDeposit: 100,
    wageringRequirement: 20,
    validFrom: now,
    validUntil: threeMonthsLater,
    description: '<p>Our Diamond VIP members deserve the best! Enjoy an <strong>exclusive 25% bonus</strong> on all deposits.</p>',
    terms: [
      'Available for Diamond VIP members only',
      'Minimum deposit of $100 required',
      'Maximum bonus amount is $5,000',
      'Wagering requirement: 20x bonus amount'
    ],
    isActive: true,
    isFeatured: true
  },
  {
    title: 'Refer a Friend',
    subtitle: 'Get $25 for Each Referral',
    image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800',
    category: 'UNLIMITED',
    bonusAmount: '$25',
    maxBonus: null,
    minDeposit: 20,
    wageringRequirement: 15,
    validFrom: now,
    validUntil: threeMonthsLater,
    description: '<p>Share the fun and earn rewards! Get <strong>$25 for every friend</strong> you refer who makes a deposit.</p>',
    terms: [
      'Friend must register using your referral link',
      'Friend must deposit minimum $20',
      'Bonus credited after friend makes first deposit',
      'No limit on number of referrals'
    ],
    isActive: true,
    isFeatured: false
  },
  {
    title: 'Weekend Slots Tournament',
    subtitle: '$10,000 Prize Pool',
    image: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=800',
    category: 'SLOTS',
    bonusAmount: '$10,000',
    maxBonus: 2500,
    minDeposit: 10,
    wageringRequirement: 1,
    validFrom: now,
    validUntil: threeMonthsLater,
    description: '<p>Compete against other players for a share of the <strong>$10,000 prize pool</strong> every weekend!</p>',
    terms: [
      'Tournament runs every Saturday and Sunday',
      'Minimum $10 deposit to participate',
      'Top 50 players win prizes',
      'First place wins $2,500'
    ],
    isActive: true,
    isFeatured: true
  },
  {
    title: 'Daily Drops',
    subtitle: 'Win Up to $500 Daily',
    image: 'https://images.unsplash.com/photo-1559526324-593bc073d938?w=800',
    category: 'UNLIMITED',
    bonusAmount: '$500',
    maxBonus: 500,
    minDeposit: 0,
    wageringRequirement: 1,
    validFrom: now,
    validUntil: threeMonthsLater,
    description: '<p>Random prizes drop throughout the day! You could win up to <strong>$500 in random drops</strong>.</p>',
    terms: [
      'Play any eligible slot game to participate',
      'Prizes awarded randomly',
      'Multiple wins possible per day',
      'No wagering on prize wins'
    ],
    isActive: true,
    isFeatured: false
  },
  {
    title: 'High Roller Bonus',
    subtitle: '200% VIP Deposit Bonus',
    image: 'https://images.unsplash.com/photo-1553481187-be93c21490a9?w=800',
    category: 'VIP',
    bonusAmount: '200%',
    maxBonus: 10000,
    minDeposit: 1000,
    wageringRequirement: 25,
    validFrom: now,
    validUntil: threeMonthsLater,
    description: '<p>Big deposits deserve big rewards! Get <strong>200% bonus</strong> on deposits of $1,000+.</p>',
    terms: [
      'Minimum deposit of $1,000 required',
      'Maximum bonus amount is $10,000',
      'Wagering requirement: 25x bonus amount',
      'Available once per week'
    ],
    isActive: true,
    isFeatured: false
  },
  {
    title: 'Birthday Bonus',
    subtitle: 'Free $50 on Your Birthday',
    image: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800',
    category: 'UNLIMITED',
    bonusAmount: '$50',
    maxBonus: 50,
    minDeposit: 0,
    wageringRequirement: 10,
    validFrom: now,
    validUntil: threeMonthsLater,
    description: '<p>Celebrate your special day with us! Enjoy a <strong>free $50 birthday bonus</strong>.</p>',
    terms: [
      'Must have verified account with date of birth',
      'Bonus available within 7 days of birthday',
      'Must have made at least one deposit previously',
      'One birthday bonus per year'
    ],
    isActive: true,
    isFeatured: false
  }
];
