// Where people reach us. SUPPORT_EMAIL receives Contact-page messages and is shown on the Contact page.
// Unset (no mailbox yet): messages still reach staff under Moderation → Support, and no address is shown.
export const supportEmail = () => process.env.SUPPORT_EMAIL || null;

export const CONTACT_TOPICS = [
  ["account", "My account or logging in"],
  ["listing", "Posting or managing a listing"],
  ["scam", "Report a scam or suspicious agent"],
  ["appeal", "Appeal a suspension or rejected listing"],
  ["privacy", "Privacy or my personal data"],
  ["partnership", "Agencies, developers and partnerships"],
  ["other", "Something else"],
] as const;
