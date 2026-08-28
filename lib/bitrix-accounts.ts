// Bitrix accounts that are queue/bot accounts (auto-greet before a real sales
// takes over) and display-name overrides for specific Bitrix user ids.

/** Queue/corp accounts that auto-reply before a chat is transferred to a real sales. */
export const BITRIX_QUEUE_USER_IDS: ReadonlySet<string> = new Set(["56663"]);

/** Display-name overrides applied when resolving Bitrix user ids to names. */
export const BITRIX_USER_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  "56663": "Kediaman Corp A",
};
