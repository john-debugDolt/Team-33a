// Smart Chat Response Service
// Analyzes user messages and provides relevant responses

const responsePatterns = [
  // Deposit related
  {
    keywords: ['deposit', 'add money', 'add funds', 'top up', 'topup', 'fund account', 'payment'],
    responses: [
      "To make a deposit, go to Wallet > Deposit. We support multiple payment methods including bank transfer, e-wallets, and crypto. The minimum deposit is $10.",
      "You can deposit funds by visiting your Wallet page and clicking 'Deposit'. Choose your preferred payment method and follow the instructions. Deposits are usually instant!",
      "For deposits, head to the Wallet section and select 'Deposit'. We offer various secure payment options. If you're having trouble, please let me know which payment method you're using."
    ]
  },
  // Withdrawal related
  {
    keywords: ['withdraw', 'withdrawal', 'cash out', 'cashout', 'take out money', 'get money', 'payout'],
    responses: [
      "Withdrawals can be made from Wallet > Withdraw. Processing time is typically 24-48 hours. The minimum withdrawal is $20.",
      "To withdraw your winnings, go to your Wallet and select 'Withdraw'. Enter the amount and your payment details. Our team processes withdrawals within 24-48 hours.",
      "For withdrawals, please ensure you've completed any wagering requirements on bonuses. Go to Wallet > Withdraw, and your request will be processed within 1-2 business days."
    ]
  },
  // Bonus/Promotion related
  {
    keywords: ['bonus', 'promo', 'promotion', 'free', 'reward', 'claim', 'offer', 'welcome bonus'],
    responses: [
      "Check out our Promotions page for all available bonuses! New players get a 100% welcome bonus. Click 'Claim' on any promotion to activate it.",
      "We have exciting bonuses available! Visit the Promotions section to see current offers. Remember to check the wagering requirements before claiming.",
      "For bonuses, head to the Promotions page. Each bonus has specific terms and wagering requirements. Let me know if you need help understanding any specific promotion!"
    ]
  },
  // Account issues
  {
    keywords: ['account', 'login', 'password', 'forgot', 'reset', 'cant login', 'locked', 'access'],
    responses: [
      "For account issues, try using the 'Forgot Password' link on the login page. If your account is locked, please contact us on Telegram @Team33 for quick assistance.",
      "If you're having trouble accessing your account, use the password reset option. For security locks, our team can help - reach out via Telegram or email support@team33.com.",
      "Account access problems? First, try resetting your password. If that doesn't work, your account may need verification. Contact us on Telegram @Team33 with your username."
    ]
  },
  // Games related
  {
    keywords: ['game', 'slot', 'play', 'spin', 'casino', 'not working', 'loading', 'stuck'],
    responses: [
      "If a game isn't loading, try refreshing the page or clearing your browser cache. Make sure you have a stable internet connection. Which game are you having trouble with?",
      "For game issues, first try refreshing your browser. If the problem persists, try a different browser or device. Let me know the specific game name and I can check if there are any known issues.",
      "Our games require a stable internet connection. If you're experiencing issues, try: 1) Refresh the page, 2) Clear cache, 3) Try a different browser. What game are you trying to play?"
    ]
  },
  // Balance/Money related
  {
    keywords: ['balance', 'money', 'funds', 'amount', 'missing', 'where is my', 'lost'],
    responses: [
      "Your balance is shown in the top right corner when logged in. For detailed transaction history, go to the History page. If you see a discrepancy, please provide your transaction details.",
      "Check your Wallet page for your current balance breakdown: Available Balance is what you can use, Pending Balance shows amounts being processed.",
      "If you believe there's an issue with your balance, please check your History page for recent transactions. If something looks wrong, contact us with the transaction ID."
    ]
  },
  // Verification/KYC
  {
    keywords: ['verify', 'verification', 'kyc', 'document', 'id', 'identity', 'upload'],
    responses: [
      "For account verification, go to Settings > Verification. You'll need to upload a valid ID and proof of address. Verification usually takes 24-48 hours.",
      "KYC verification is required for withdrawals over $500. Please upload a clear photo of your ID and a recent utility bill or bank statement to Settings > Verification.",
      "To complete verification, you'll need: 1) Government-issued ID (passport/driver's license), 2) Proof of address (utility bill/bank statement). Upload these in your Settings."
    ]
  },
  // VIP/Loyalty
  {
    keywords: ['vip', 'loyalty', 'level', 'tier', 'points', 'rewards', 'status'],
    responses: [
      "Your VIP level is shown in your profile. Higher levels unlock better bonuses and faster withdrawals! Keep playing to earn points and level up.",
      "We have 5 VIP tiers: Bronze, Silver, Gold, Platinum, and Diamond. Each level offers increased benefits like cashback, exclusive bonuses, and priority support.",
      "VIP status is earned through regular play. Check your current level in Settings. As you level up, you'll get better deposit bonuses, faster withdrawals, and a personal account manager!"
    ]
  },
  // Technical issues
  {
    keywords: ['error', 'bug', 'problem', 'issue', 'help', 'not working', 'broken', 'crash'],
    responses: [
      "I'm sorry you're experiencing issues. Can you tell me more about what's happening? What action were you trying to do when the problem occurred?",
      "Technical issues can often be resolved by: 1) Refreshing the page, 2) Clearing browser cache, 3) Trying a different browser. Please describe the specific error you're seeing.",
      "Let me help troubleshoot this! First, try refreshing your browser. If the issue persists, please share: 1) What you were trying to do, 2) Any error message shown, 3) Which browser you're using."
    ]
  },
  // Contact/Support
  {
    keywords: ['contact', 'support', 'help', 'talk', 'agent', 'human', 'real person', 'speak'],
    responses: [
      "You can reach our team 24/7 via Telegram @Team33 for instant support, or email support@team33.com. We typically respond within minutes!",
      "For immediate assistance, contact us on Telegram @Team33. Our support team is available 24/7 and usually responds within 2-3 minutes.",
      "I'm here to help! For complex issues, you can also reach our human support team via Telegram @Team33 or email support@team33.com. They're available around the clock!"
    ]
  },
  // Greeting
  {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
    responses: [
      "Hello! Welcome to Team33 support. How can I help you today?",
      "Hi there! I'm here to assist you with any questions about deposits, withdrawals, games, or your account. What can I help you with?",
      "Hey! Thanks for reaching out. I'm ready to help with anything you need. What would you like to know?"
    ]
  },
  // Thanks
  {
    keywords: ['thank', 'thanks', 'appreciate', 'helpful', 'great', 'awesome'],
    responses: [
      "You're welcome! Is there anything else I can help you with?",
      "Happy to help! Let me know if you have any other questions.",
      "Glad I could assist! Don't hesitate to reach out if you need anything else."
    ]
  },
  // Complaint
  {
    keywords: ['complain', 'angry', 'frustrated', 'terrible', 'worst', 'scam', 'fraud', 'cheat'],
    responses: [
      "I'm sorry to hear you're frustrated. I want to help resolve this. Can you please explain what happened so I can assist you better?",
      "I apologize for any inconvenience. Your feedback is important to us. Please share the details of your concern and I'll do my best to help or escalate to our senior team.",
      "I understand your frustration and I'm here to help. Please provide more details about the issue and I'll work to find a solution for you."
    ]
  }
];

// Default responses when no pattern matches
const defaultResponses = [
  "I'm not sure I understood that. Could you please rephrase your question? You can ask about deposits, withdrawals, bonuses, account issues, or games.",
  "I want to make sure I help you correctly. Are you asking about: deposits, withdrawals, bonuses, your account, or something else?",
  "Could you provide more details? I can help with deposits, withdrawals, promotions, account settings, game issues, and more.",
  "I'd love to help! Try asking about specific topics like 'How do I deposit?' or 'What bonuses are available?' for the best assistance."
];

// Analyze message and return appropriate response
export const getSmartResponse = (message) => {
  const lowerMessage = message.toLowerCase();

  // Check each pattern for matching keywords
  for (const pattern of responsePatterns) {
    for (const keyword of pattern.keywords) {
      if (lowerMessage.includes(keyword)) {
        // Return a random response from the matching pattern
        const randomIndex = Math.floor(Math.random() * pattern.responses.length);
        return {
          text: pattern.responses[randomIndex],
          matched: true,
          topic: keyword
        };
      }
    }
  }

  // No pattern matched, return default response
  const randomIndex = Math.floor(Math.random() * defaultResponses.length);
  return {
    text: defaultResponses[randomIndex],
    matched: false,
    topic: null
  };
};

// Get follow-up suggestions based on the conversation
export const getSuggestions = (lastTopic) => {
  const suggestions = {
    deposit: ['What payment methods do you accept?', 'Is there a deposit bonus?', 'How long do deposits take?'],
    withdraw: ['What is the minimum withdrawal?', 'How long do withdrawals take?', 'Can I cancel a withdrawal?'],
    bonus: ['What are the wagering requirements?', 'How do I claim a bonus?', 'When do bonuses expire?'],
    account: ['How do I change my password?', 'How do I verify my account?', 'Can I change my username?'],
    game: ['Which games have the best RTP?', 'Are there any new games?', 'Why is my game lagging?'],
    default: ['How do I deposit?', 'What bonuses are available?', 'How do I withdraw?', 'Contact support']
  };

  return suggestions[lastTopic] || suggestions.default;
};

export default { getSmartResponse, getSuggestions };
